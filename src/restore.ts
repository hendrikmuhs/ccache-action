import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as exec from "@actions/exec";
import * as process from "process";
import * as cache from "@actions/cache";

const SELF_CI = process.env["CCACHE_ACTION_CI"] === "true"

// based on https://cristianadam.eu/20200113/speeding-up-c-plus-plus-github-actions-using-ccache/

async function restore(ccacheVariant : string) : Promise<void> {
  const inputs = {
    primaryKey: core.getInput("key"),
    // https://github.com/actions/cache/blob/73cb7e04054996a98d39095c0b7821a73fb5b3ea/src/utils/actionUtils.ts#L56
    restoreKeys: core.getInput("restore-keys").split("\n").map(s => s.trim()).filter(x => x !== "")
  };

  const keyPrefix = ccacheVariant + "-";
  const primaryKey = inputs.primaryKey ? keyPrefix + inputs.primaryKey + "-" : keyPrefix;
  const restoreKeys = inputs.restoreKeys.map(k => keyPrefix + k + "-")
  const paths = [`.${ccacheVariant}`];

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

async function configure(ccacheVariant : string) : Promise<void> {
  const ghWorkSpace = process.env.GITHUB_WORKSPACE || "unreachable, make ncc happy";
  const maxSize = core.getInput('max-size');
  
  if (ccacheVariant === "ccache") {
    await execBash(`ccache --set-config=cache_dir='${path.join(ghWorkSpace, '.ccache')}'`);
    await execBash(`ccache --set-config=max_size='${maxSize}'`);
    await execBash(`ccache --set-config=compression=true`);
    core.info("Cccache config:");
    await execBash("ccache -p");
  } else {
    const options = `SCCACHE_IDLE_TIMEOUT=0 SCCACHE_DIR='${ghWorkSpace}'/.sccache SCCACHE_CACHE_SIZE='${maxSize}'`;
    await execBash(`env ${options} sccache --start-server`);
  }

}

async function installCcacheMac() : Promise<void> {
  await execBash("brew install ccache");
}

async function installCcacheLinux() : Promise<void> {
  await execBashSudo("apt-get install -y ccache");
}

async function installCcacheWindows() : Promise<void> {
  await installCcacheFromGitHub(
    "4.6",
    "windows-64",
    "e721aac12692e35fb644c801f3ad1af66d88c3ac5ba10fbe6bdacc347e2a0e3f",
    // TODO find a better place
    "C:\\Users\\runneradmin\\.cargo\\bin",
    "ccache.exe"
  );
}

async function installSccacheMac() : Promise<void> {
  await execBash("brew install sccache");
}

async function installSccacheLinux() : Promise<void> {
  await installSccacheFromGitHub(
    "v0.3.0",
    "x86_64-unknown-linux-musl",
    "594b4323aaee02d3b5e1e19c20eb63acb53fd8ecd3c0a3e43618a6e9e36af2fe",
    "/usr/local/bin/",
    "sccache"
  );
}

async function installSccacheWindows() : Promise<void> {
  await installSccacheFromGitHub(
    "v0.3.0",
    "x86_64-pc-windows-msvc",
    "e58646b1c377c7f873c7e13ae7298631fb490703ee15ad67ce326ed0dde2067e",
    // TODO find a better place
    "C:\\Users\\runneradmin\\.cargo\\bin",
    "sccache.exe"
  );
}

async function execBash(cmd : string) {
  await exec.exec("bash", ["-xc", cmd]);
}

async function execBashSudo(cmd : string) {
  await execBash("$(which sudo) " + cmd);
}

async function installCcacheFromGitHub(version : string, artifactName : string, binSha256 : string, binDir : string, binName : string) : Promise<void> {
  const archiveName = `ccache-${version}-${artifactName}`;
  const url = `https://github.com/ccache/ccache/releases/download/v${version}/${archiveName}.zip`;
  const binPath = path.join(binDir, binName);
  await downloadAndExtract(url, path.join(archiveName, binName), binPath);
  checkSha256Sum(binPath, binSha256);
}

async function installSccacheFromGitHub(version : string, artifactName : string, binSha256 : string, binDir : string, binName : string) : Promise<void> {
  const archiveName = `sccache-${version}-${artifactName}`;
  const url = `https://github.com/mozilla/sccache/releases/download/${version}/${archiveName}.tar.gz`;
  const binPath = path.join(binDir, binName);
  await downloadAndExtract(url, `*/${binName}`, binPath);
  checkSha256Sum(binPath, binSha256);
  await execBash(`chmod +x '${binPath}'`);
}

async function downloadAndExtract (url : string, srcFile : string, dstFile : string) {
  if (url.endsWith(".zip")) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), ""));
    const zipName = path.join(tmp, "dl.zip");
    await execBash(`curl -L '${url}' -o '${zipName}'`);
    await execBash(`unzip '${zipName}' -d '${tmp}'`);
    fs.copyFileSync(path.join(tmp, srcFile), dstFile);
    fs.rmSync(tmp, { recursive: true });
  } else {
    await execBash(`curl -L '${url}' | tar xzf - -O --wildcards '${srcFile}' > '${dstFile}'`);
  }
}

function checkSha256Sum (path : string, expectedSha256 : string) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(path));
  const actualSha256 = h.digest("hex");
  if (actualSha256  !== expectedSha256) {
    throw Error(`SHA256 of ${path} is ${actualSha256}, expected ${expectedSha256}`);
  }
}

async function runInner() : Promise<void> {
  const ccacheVariant = core.getInput("variant");
  core.saveState("ccacheVariant", ccacheVariant);
  core.saveState("shouldSave", core.getBooleanInput("save"));
  let ccachePath = await io.which(ccacheVariant);
  if (!ccachePath) {
    core.startGroup(`Install ${ccacheVariant}`);
    const installer = {
      ["ccache,linux"]: installCcacheLinux,
      ["ccache,darwin"]: installCcacheMac,
      ["ccache,win32"]: installCcacheWindows,
      ["sccache,linux"]: installSccacheLinux,
      ["sccache,darwin"]: installSccacheMac,
      ["sccache,win32"]: installSccacheWindows,
    }[[ccacheVariant, process.platform].join()];
    if (!installer) {
      throw Error(`Unsupported platform: ${process.platform}`)
    }
    await installer();
    core.info(await io.which(ccacheVariant + ".exe"));
    ccachePath = await io.which(ccacheVariant, true);
    core.endGroup();
  }

  core.startGroup("Restore cache");
  await restore(ccacheVariant);
  core.endGroup();

  core.startGroup(`Configure ${ccacheVariant}`);
  await configure(ccacheVariant);
  await execBash(`${ccacheVariant} -z`);
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
