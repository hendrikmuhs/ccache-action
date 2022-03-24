# Ccache for gh actions

A Github action to speedup building using ccache/sccache for C/C++ projects.

Works on Linux, macOS, and Windows.

## Example usage

```yaml
- run: apt update  # Only for Docker jobs
- name: ccache
  uses: hendrikmuhs/ccache-action@v1.2
```

NB! This should always come after the `actions/checkout` step.

For sccache, use:

```yaml
- name: ccache
  uses: hendrikmuhs/ccache-action@v1.2
  with:
    variant: sccache
```

In order to use ccache in your other steps, point the compiler to it, e.g. with `run-cmake`:

```yaml
- name: build with cmake
  uses: lukka/run-cmake@v3
  with:
    cmakeListsOrSettingsJson: CMakeListsTxtAdvanced
    cmakeAppendedArgs: '-DCMAKE_BUILD_TYPE=${{ matrix.type }} -D CMAKE_C_COMPILER_LAUNCHER=ccache -D CMAKE_CXX_COMPILER_LAUNCHER=ccache'
    ...
```

or by manipulating `PATH` (ccache only):

```yaml
- name: build
  run: |
    export PATH="/usr/lib/ccache:/usr/local/opt/ccache/libexec:$PATH"
```

(works for both `ubuntu` and `macos`)

Ccache/sccache gets installed by this action if it is not installed yet.

Note that using Ccache on Windows is still experimental and [works only in Bash](https://github.com/ccache/ccache/issues/1023).
Use Sccache for stable Windows support.

## Configuration

If you have multiple targets(`Debug`, `Release`) and/or multiple OS's, it makes sense to cache them
separately. An additional cache key can be specified.
You can also specify the maximum cache size - default `500M` (500 MB).

```yaml
- name: ccache
  uses: hendrikmuhs/ccache-action@v1.2
  with:
    key: ${{ matrix.os }}-${{ matrix.type }}
    max-size: 100M
```

## How it works

This action is based on https://cristianadam.eu/20200113/speeding-up-c-plus-plus-github-actions-using-ccache/

In a nutshell, the `.ccache` folder is configured in the runner path and the folder is persisted and reloaded using [`cache`](https://github.com/actions/toolkit/tree/main/packages/cache).
For more details see: https://docs.github.com/en/free-pro-team@latest/actions/guides/caching-dependencies-to-speed-up-workflows.

## Stats

Stats are provided as part of the post action, check the output to see if cache is effective.

You may also set `verbose` input to 1 to enable verbose output from this action or even to 2
to make it even more verbose.

## Example workflow

 - [Keyvi](https://github.com/KeyviDev/keyvi/blob/master/.github/workflows/keyvi.yml)
