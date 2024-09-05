# Ccache for gh actions

A Github action to speedup building using ccache/sccache for C/C++ projects.

Works on Linux, macOS, and Windows.

## Usage

```yaml
- run: apt update  # Only for Docker jobs
- name: ccache
  uses: hendrikmuhs/ccache-action@v1.2
```

NB! This should always come after the `actions/checkout` step.

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

or by setting create-symlink to `true`:

```yaml
- name: ccache
  uses: hendrikmuhs/ccache-action@v1.2
  with:
    create-symlink: true
```


Ccache/sccache gets installed by this action if it is not installed yet.

### Example workflow

 - [Keyvi](https://github.com/KeyviDev/keyvi/blob/master/.github/workflows/keyvi.yml)


### Notes on Windows support

Note that using Ccache on Windows [probably works](https://ccache.dev/platform-compiler-language-support.html), but 
Sccache is recommended for stable Windows support.

### If you have multiple jobs

If you have multiple jobs or targets (eg. `Debug`, `Release`) or multiple OS's, it makes sense to cache them
separately. An additional cache key can be specified.

```yaml
jobs:
  some_build:
    steps:
      ...
      - name: ccache
        uses: hendrikmuhs/ccache-action@v1.2
        with:
          key: ${{ github.job }}-${{ matrix.os }}  # Eg. "some_build-ubuntu-latest"
  some_other_build:
    ...
```

### Other options

See [action.yml](./action.yml) for a full list of options.

### Ccache statistics

Stats are provided as part of the post action, check the output to see if cache is effective.

You may also set `verbose` input to 1 to enable verbose output from this action or even to 2
to make it even more verbose.

## How it works

This action is based on https://cristianadam.eu/20200113/speeding-up-c-plus-plus-github-actions-using-ccache/

In a nutshell, the `.ccache` folder is configured in the runner path and the folder is persisted and reloaded using [`cache`](https://github.com/actions/toolkit/tree/main/packages/cache).
For more details see: https://docs.github.com/en/free-pro-team@latest/actions/guides/caching-dependencies-to-speed-up-workflows.
