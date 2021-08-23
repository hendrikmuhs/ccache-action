import * as core from "@actions/core";
import * as io from "@actions/io";
import * as exec from "@actions/exec";
import * as process from "process";
import * as cache from "@actions/cache";

// based on https://cristianadam.eu/20200113/speeding-up-c-plus-plus-github-actions-using-ccache/

async function install() {
  if (process.platform === "darwin") {
    await exec.exec("brew install ccache");
  } else {
    await exec.exec("sudo apt-get install -y ccache");
  }
}

async function restore() {
  let restoreKey = `ccache_action`;

  const inputKey = core.getInput("key");
  if (inputKey) {
    restoreKey += `-${inputKey}`;
  }

  const restoreKeys = [
    restoreKey
  ]

  const paths = [
    '.ccache'
  ]

  const restoredWith = await cache.restoreCache(paths, restoreKey, restoreKeys)
  if (restoredWith) {
    core.info(`Restored from cache key "${restoredWith}".`);
  } else {
    core.info("No cache found.");
  }
}

async function configure() {
  const ghWorkSpace = process.env.GITHUB_WORKSPACE;
  const maxSize = core.getInput('max-size');

  core.info("Configure ccache");
  await exec.exec("ccache --set-config=cache_dir=" + ghWorkSpace + "/.ccache");
  await exec.exec("ccache --set-config=max_size=" + maxSize);
  await exec.exec("ccache --set-config=compression=true");

  core.info("Ccache config:")
  await exec.exec("ccache -p");
}

async function run() : Promise<void> {
  try {
    let ccachePath = await io.which("ccache");
    if (!ccachePath) {
      core.info(`Install ccache`);
      await install();
      ccachePath = await io.which("ccache", true);
    }

    await restore();
    await configure();

    await exec.exec("ccache -z");
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

export default run;
