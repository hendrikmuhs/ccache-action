# Firebuild for GitHub Actions

A GitHub Action to speed up (build) commands using [Firebuild](https://github.com/firebuild/firebuild)

Works on Linux

## Usage

```yaml
- name: firebuild
  uses: firebuild/firebuild-action@v2.0
    with:
      accept-firebuild-license: true
```

NB! This should always come after the `actions/checkout` step.

The Firebuild license can be read at [firebuild.com](https://firebuild.com).

In order to use firebuild in your steps, prefix the commands to be accelerated with "firebuild "

```yaml
- name: build
  run: |
   firebuild <your command>
    ...
```

Firebuild gets installed by this action if it is not installed yet.

### If you have multiple jobs

If you have multiple jobs or targets (eg. `Debug`, `Release`) or multiple OS's, it makes sense to cache them
separately. An additional cache key can be specified.

```yaml
jobs:
  some_build:
    steps:
      ...
      - name: firebuild
        uses: firebuild/firebuild-action@v2.0
        with:
          key: ${{ github.job }}-${{ matrix.os }}  # Eg. "some_build-ubuntu-latest"
          accept-firebuild-license: true
  some_other_build:
    ...
```

### Other options

See [action.yml](./action.yml) for a full list of options.

### Firebuild statistics

Stats are provided as part of the post action, check the output to see if cache is effective.

## How it works

This action is based on https://cristianadam.eu/20200113/speeding-up-c-plus-plus-github-actions-using-ccache/

In a nutshell, the `.cache/firebuild` folder is configured in the runner path and the folder is persisted and reloaded using [`cache`](https://github.com/actions/toolkit/tree/main/packages/cache).
For more details see: https://docs.github.com/en/free-pro-team@latest/actions/guides/caching-dependencies-to-speed-up-workflows.
