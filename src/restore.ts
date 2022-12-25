import * as core from "@actions/core";
import * as io from "@actions/io";
import * as exec from "@actions/exec";
import * as process from "process";
import * as cache from "@actions/cache";

const SELF_CI = process.env["FIREBUILD_ACTION_CI"] === "true"

// based on https://cristianadam.eu/20200113/speeding-up-c-plus-plus-github-actions-using-ccache/

async function restore() : Promise<void> {
  const inputs = {
    primaryKey: core.getInput("key"),
    // https://github.com/actions/cache/blob/73cb7e04054996a98d39095c0b7821a73fb5b3ea/src/utils/actionUtils.ts#L56
    restoreKeys: core.getInput("restore-keys").split("\n").map(s => s.trim()).filter(x => x !== "")
  };

  const keyPrefix = "firebuild-";
  const primaryKey = inputs.primaryKey ? keyPrefix + inputs.primaryKey + "-" : keyPrefix;
  const restoreKeys = inputs.restoreKeys.map(k => keyPrefix + k + "-")
  const paths = [".cache/firebuild"];

  core.saveState("primaryKey", primaryKey);

  const restoredWith = await cache.restoreCache(paths, primaryKey, restoreKeys);
  if (restoredWith) {
    core.info(`Restored from cache key "${restoredWith}".`);
    if (SELF_CI) {
      core.setOutput("test-cache-hit", true)
    }
  } else {
    core.info("No cache found.");
    if (SELF_CI) {
      core.setOutput("test-cache-hit", false)
    }
  }
}

async function configure() : Promise<void> {
  const ghWorkSpace = process.env.GITHUB_WORKSPACE || "unreachable, make ncc happy";
  const maxSize = core.getInput('max-size');
  
  await execBashSudo(`sed -i 's/^max_cache_size = .*/max_cache_size = ${maxSize}/' /etc/firebuild.conf`);
  process.env["FIREBUILD_CACHE_DIR"] = `${ghWorkSpace}/.cache/firebuild`
  core.info("Firebuild config:");
  await execBash("cat /etc/firebuild.conf");
}

async function installFirebuildLinux() : Promise<void> {
  await execBashSudo("sh -c 'echo debconf firebuild/license-accepted select true | debconf-set-selections'");
  await execBashSudo("sh -c 'type add-apt-repository 2> /dev/null > /dev/null || apt-get install -y software-properties-common'");
  await execBashSudo("add-apt-repository -y ppa:firebuild/stable");
  await execBashSudo("apt-get install -y firebuild");
}

async function execBash(cmd : string) {
  await exec.exec("bash", ["-xc", cmd]);
}

async function execBashSudo(cmd : string) {
  await execBash("$(which sudo) " + cmd);
}

async function runInner() : Promise<void> {
  core.saveState("shouldSave", core.getBooleanInput("save"));
  let firebuildPath = await io.which("firebuild");
  if (!firebuildPath) {
    core.startGroup("Install firebuild");
    if (process.platform != "linux") {
      throw Error(`Unsupported platform: ${process.platform}`)
    }
    await installFirebuildLinux();
    core.info(await io.which("firebuild.exe"));
    firebuildPath = await io.which("firebuild", true);
    core.endGroup();
  }

  core.startGroup("Restore cache");
  await restore();
  core.endGroup();

  core.startGroup("Configure firebuild");
  await configure();
  await execBash("firebuild -z");
  core.endGroup();
}

async function run() : Promise<void> {
  try {
    await runInner();
  } catch (error) {
    core.setFailed(`Restoring cache failed: ${error}`);
  }
}

run();

export default run;
