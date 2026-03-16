#!/bin/sh -e

_in="metadata/metadata.json"
_out="dist/restore/metadata.json"

# check if version $1 is $2 or higher
version_gte() {
	v1=$1
	v2=$2

	# check each of the three fields
	[ "$v1" = "$(printf '%s\n%s' "$v1" "$v2" | sort -t. -k1,1n -k2,2n -k3,3n | tail -n 1)" ]
}

# helper errors
_bad_platform() {
	echo "Invalid platform $1. Valid platforms are: darwin, linux, windows"
	exit 1
}

_bad_variant() {
	echo "Invalid variant $1. Valid variants are: sccache, ccache"
	exit 1
}

# generate json for variant, arch, platform, version
package_info() {
	variant="$1"
	arch="$2"
	platform="$3"
	version="$4"

	ext="tar.gz"

	_bin="$variant"
	if [ "$platform" = windows ]; then
		_bin="$_bin.exe"
	fi

	# artifact name, etc
	if [ "$variant" = "ccache" ]; then
		case "$platform" in
		darwin)
			pkg_name="ccache-$version-darwin"
			;;
		linux)
			if version_gte "$version" "4.13"; then
				pkg_name="ccache-$version-$platform-$arch-musl-static"
			else
				pkg_name="ccache-$version-$platform-$arch"
			fi
			ext="tar.xz"
			;;
		windows)
			pkg_name="ccache-$version-$platform-$arch"
			ext="zip"
			;;
		*) _bad_platform "$platform" ;;
		esac
	else
		case "$platform" in
		linux) suffix="unknown-linux-musl" ;;
		windows) suffix="pc-windows-msvc" ;;
		darwin) suffix="apple-darwin" ;;
		*) _bad_platform "$platform" ;;
		esac

		pkg_name="sccache-$version-$arch-$suffix"
	fi

	artifact="$pkg_name.$ext"

	# repo/prefix handling
	case "$variant" in
	ccache)
		_repo=ccache/ccache
		v_prefix=v
		;;
	sccache)
		_repo=mozilla/sccache
		;;
	*) _bad_variant "$variant" ;;
	esac

	# dl artifact
	url="https://github.com/$_repo/releases/download/${v_prefix}${version}/$artifact"
	_tmp="$(mktemp -d)"

	_dl="$_tmp/$artifact"
	curl -Ls "$url" -o "$_dl"

	# extract bin & calc hash
	internal_path="$pkg_name/$_bin"

	if [ "$ext" = "zip" ]; then
		unzip -p "$_dl" "$internal_path" >"$_tmp/bin"
	else
		tar xf "$_dl" -O "$internal_path" >"$_tmp/bin"
	fi

	sha256=$(sha256sum "$_tmp/bin" | cut -d' ' -f 1)

	jq -n \
		--arg url "$url" \
		--arg sha "$sha256" \
		--arg dir "$pkg_name" \
		--arg artifact "$artifact" \
		'{url: $url, sha256: $sha, dir: $dir, artifact: $artifact}'

	rm -rf "$_tmp"
}

# now calc hashes...
_tmp="$(mktemp)"
echo "{}" >"$_tmp"

# shellcheck disable=SC2016
_filter='
  to_entries[] | .key as $v |
  .value | to_entries[] | .key as $a |
  .value | to_entries[] | .key as $p |
  "\($v) \($a) \($p) \(.value)"
'

_results=$(jq -r "$_filter" "$_in" | while read -r v a p ver; do
	echo "$v $p-$a" >&2

	# info contains url, sha256, and extracted dir
	info=$(package_info "$v" "$a" "$p" "$ver")

	# flat stream, expands to e.g. "ccache": { "x86_64": { "linux": {}}}
	printf '{"v": "%s", "a": "%s", "p": "%s", "info": %s}\n' \
		"$v" "$a" "$p" "$info"
done | jq -s 'reduce .[] as $item ({}; .[$item.v][$item.a][$item.p] = $item.info)')

# done :)
echo "$_results" >"$_out"
echo "-- Metadata generated in $_out"
