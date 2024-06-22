import * as core from "@actions/core";
import * as cache from "@actions/cache";
import * as exec from "@actions/exec";

async function ccacheIsEmpty(ccacheVariant : string, ccacheKnowsVerbosityFlag : boolean) : Promise<boolean> {
  if (ccacheVariant === "ccache") {
    if (ccacheKnowsVerbosityFlag) {
      return !!(await getExecBashOutput("ccache -s -v")).stdout.match(/Files:.+\b0\b/);
    } else {
      return !!(await getExecBashOutput("ccache -s")).stdout.match(/files in cache.+\b0\b/)
    }
  } else {
    return !!(await getExecBashOutput("sccache -s")).stdout.match(/Cache size.+\b0 bytes/);
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
  return exec.getExecOutput("bash", ["-xc", cmd], {silent: true});
}

async function run(earlyExit : boolean | undefined) : Promise<void> {
  try {
    const ccacheVariant = core.getState("ccacheVariant");
    const primaryKey = core.getState("primaryKey");
    if (!ccacheVariant || !primaryKey) {
      core.notice("ccache setup failed, skipping saving.");
      return;
    }

    // Some versions of ccache do not support --verbose
    const ccacheKnowsVerbosityFlag = !!(await getExecBashOutput(`${ccacheVariant} --help`)).stdout.includes("--verbose");

    core.startGroup(`${ccacheVariant} stats`);
    const verbosity = ccacheKnowsVerbosityFlag ? await getVerbosity(core.getInput("verbose")) : '';
    await exec.exec(`${ccacheVariant} -s${verbosity}`);
    core.endGroup();
    
    if (core.getState("shouldSave") !== "true") {
      core.info("Not saving cache because 'save' is set to 'false'.");
      return;
    }

    if (await ccacheIsEmpty(ccacheVariant, ccacheKnowsVerbosityFlag)) {
      core.info("Not saving cache because no objects are cached.");
    } else {
      let saveKey = primaryKey;
      if (core.getState("appendTimestamp") == "true") {
        saveKey += `-${new Date().toISOString()}`;
      } else {
        core.debug("Not appending timestamp because 'append-timestamp' is not set to 'true'.");
      }
      const paths = [`.${ccacheVariant}`];
    
      core.info(`Save cache using key "${saveKey}".`);
      await cache.saveCache(paths, saveKey);
    }
  } catch (error) {
    // A failure to save cache shouldn't prevent the entire CI run from
    // failing, so do not call setFailed() here.
    core.warning(`Saving cache failed: ${error}`);
  }

  // Since we are not using http requests after this
  // we can safely exit early
  if (earlyExit) {
    process.exit(0);
  }
}

run(true);

export default run;
