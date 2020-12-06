import * as core from "@actions/core";
import * as cache from "@actions/cache";

async function run() : Promise<void> {
  try{
    let restoreKey = `ccache-`;
    let inputKey = core.getInput("key");

    if (inputKey) {
      restoreKey += `${inputKey}-`;
    }

    const key = restoreKey + "-" + new Date().toISOString();
    const paths = [
      '.ccache'
    ]
  
    await cache.saveCache(paths, key);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

export default run;
