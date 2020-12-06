import * as core from "@actions/core";
import * as cache from "@actions/cache";
import * as exec from "@actions/exec";

async function run() : Promise<void> {
  try{
    core.info("Ccache stats:")
    await exec.exec("ccache -s");

    let restoreKey = `ccache-`;
    let inputKey = core.getInput("key");

    if (inputKey) {
      restoreKey += `${inputKey}-`;
    }

    const key = restoreKey + "-" + new Date().toISOString();
    const paths = [
      '.ccache'
    ]
  
    core.info(`Save cache using key "${key}".`)
    await cache.saveCache(paths, key);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

export default run;
