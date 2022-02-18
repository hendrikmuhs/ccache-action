import * as core from "@actions/core";
import * as cache from "@actions/cache";
import * as exec from "@actions/exec";

async function run() : Promise<void> {
  try {
    const ccacheVariant = core.getState("ccacheVariant");
    const primaryKey = core.getState("primaryKey");
    if (!ccacheVariant || !primaryKey) {
      core.notice("ccache setup failed, skipping saving.");
      return;
    }
    core.info(`${ccacheVariant} stats:`);
    const verbosity = await getVerbosity(ccacheVariant, core.getInput("verbose"));
    await exec.exec(`${ccacheVariant} -s${verbosity}`);

    const key = primaryKey + new Date().toISOString();
    const paths = [
      `.${ccacheVariant}`
    ]
  
    core.info(`Save cache using key "${key}".`);
    await cache.saveCache(paths, key);
  } catch (error) {
    core.setFailed(`Saving cache failed: ${error}`);
  }
}

async function getVerbosity(ccacheVariant : string, verbositySetting : string) {
  // Some versions of ccache do not support --verbose
  if (!(await exec.getExecOutput(`${ccacheVariant} --help`)).stdout.includes("--verbose")) {
    return '';
  }
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

run();

export default run;
