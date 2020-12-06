import * as core from "@actions/core";
import * as cache from "@actions/cache";

async function run() {
  let restoreKey = `ccache-`;
  let inputKey = core.getInput("key");

  if (inputKey) {
    restoreKey += `${inputKey}-`;
  }

  const key = restoreKey + "-" + new Date().toUTCString();
  const paths = [
    '.ccache'
  ]
  
  await cache.saveCache(paths, key)
}

try {
  run();
} catch (err) {
  core.setFailed(`Action failed with error ${err}`);
}
