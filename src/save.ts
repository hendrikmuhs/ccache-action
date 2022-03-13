import * as core from "@actions/core";
import * as cache from "@actions/cache";
import * as exec from "@actions/exec";

async function ccacheIsEmpty(ccacheVariant : string, ccacheKnowsVerbosityFlag : boolean) : Promise<boolean> {
  if (ccacheVariant === "ccache") {
    if (ccacheKnowsVerbosityFlag) {
      return !!(await getExecBashOutput("ccache -s -v")).stdout.match(/Files:.+0/);
    } else {
      return !!(await getExecBashOutput("ccache -s")).stdout.match(/files in cache.+0/)
    }
  } else {
    return !!(await getExecBashOutput("sccache -s")).stdout.match(/Cache size.+0 bytes/);
  }
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
  return exec.getExecOutput("bash", ["-xc", cmd]);
}

async function run() : Promise<void> {
  try {
    const ccacheVariant = core.getState("ccacheVariant");
    const primaryKey = core.getState("primaryKey");
    if (!ccacheVariant || !primaryKey) {
      core.notice("ccache setup failed, skipping saving.");
      return;
    }

    // Some versions of ccache do not support --verbose
    const ccacheKnowsVerbosityFlag = !!(await getExecBashOutput(`${ccacheVariant} --help`)).stdout.includes("--verbose");

    core.info(`${ccacheVariant} stats:`);
    const verbosity = ccacheKnowsVerbosityFlag ? await getVerbosity(core.getInput("verbose")) : '';
    await exec.exec(`${ccacheVariant} -s${verbosity}`);

    if (await ccacheIsEmpty(ccacheVariant, ccacheKnowsVerbosityFlag)) {
      core.info("Not saving cache because no objects are cached.");
    } else {
      const saveKey = primaryKey + new Date().toISOString();
      const paths = [`.${ccacheVariant}`];
    
      core.info(`Save cache using key "${saveKey}".`);
      await cache.saveCache(paths, saveKey);
    }
  } catch (error) {
    core.setFailed(`Saving cache failed: ${error}`);
  }
}

run();

export default run;
