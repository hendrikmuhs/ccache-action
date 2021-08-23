import * as core from "@actions/core";
import * as cache from "@actions/cache";
import * as exec from "@actions/exec";

async function run() : Promise<void> {
  try{
    core.info("Ccache stats:")
    await exec.exec("ccache -s");

    let saveKey = `ccache`;

    const inputKey = core.getInput("key");
    if (inputKey) {
      saveKey += `-${inputKey}`;
    }

    const paths = [
      '.ccache'
    ]

    core.info(`Save cache using key "${saveKey}".`)
    await cache.saveCache(paths, saveKey);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

export default run;
