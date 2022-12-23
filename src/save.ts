import * as core from "@actions/core";
import * as cache from "@actions/cache";
import * as exec from "@actions/exec";

async function firebuildIsEmpty() : Promise<boolean> {
  return !!(await getExecBashOutput("firebuild -s")).stdout.match(/Cache size.+\b 0\.00 kB/);
}

async function getVerbosity(verbositySetting : string) : Promise<string> {
  switch (verbositySetting) {
    case '0':
      return '';

    case '1':
      return ' -v';

    case '2':
      return ' -vv';

    default:
      core.warning(`Invalid value "${verbositySetting}" of "verbose" option ignored.`);
      return '';
  }
}

function getExecBashOutput(cmd : string) : Promise<exec.ExecOutput> {
  return exec.getExecOutput("bash", ["-xc", cmd], {silent: true});
}

async function run() : Promise<void> {
  try {
    if (core.getState("shouldSave") !== "true") {
      core.info("Not saving cache because 'save' is set to 'false'.");
      return;
    }
    const primaryKey = core.getState("primaryKey");
    if (!primaryKey) {
      core.notice("firebuild setup failed, skipping saving.");
      return;
    }

    // Some versions of firebuild do not support --verbose
    const firebuildKnowsVerbosityFlag = !!(await getExecBashOutput("firebuild --help")).stdout.includes("--verbose");

    core.startGroup("firebuild stats");
    const verbosity = firebuildKnowsVerbosityFlag ? await getVerbosity(core.getInput("verbose")) : '';
    await exec.exec(`firebuild -s${verbosity}`);
    core.endGroup();

    if (await firebuildIsEmpty()) {
      core.info("Not saving cache because no objects are cached.");
    } else {
      const saveKey = primaryKey + new Date().toISOString();
      const paths = [".cache/firebuild"];
    
      core.info(`Save cache using key "${saveKey}".`);
      await cache.saveCache(paths, saveKey);
    }
  } catch (error) {
    // A failure to save cache shouldn't prevent the entire CI run from
    // failing, so do not call setFailed() here.
    core.warning(`Saving cache failed: ${error}`);
  }
}

run();

export default run;
