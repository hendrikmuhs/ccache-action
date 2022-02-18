import * as core from "@actions/core";
import * as io from "@actions/io";
import * as exec from "@actions/exec";
import * as process from "process";
import * as cache from "@actions/cache";

// based on https://cristianadam.eu/20200113/speeding-up-c-plus-plus-github-actions-using-ccache/

async function restore(ccacheVariant : string) {
  let restoreKey = `${ccacheVariant}-`;

  let inputKey = core.getInput("key");
  if (inputKey) {
    restoreKey += `${inputKey}-`;
  }

  const restoreKeys = [
    restoreKey
  ]
  
  const key = restoreKey + new Date().toISOString();

  const paths = [
    `.${ccacheVariant}`
  ]  

  core.saveState("primaryKey", key)
  const restoredWith = await cache.restoreCache(paths, key, restoreKeys)
  if (restoredWith) {
    core.info(`Restored from cache key "${restoredWith}".`);
  } else {
    core.info("No cache found.");
  }
}

async function configure(ccacheVariant : string) {
  const ghWorkSpace = process.env.GITHUB_WORKSPACE;
  const maxSize = core.getInput('max-size');
  
  core.info(`Configure ${ccacheVariant}`);
  if (ccacheVariant === "ccache") {
    await exec.exec(`ccache --set-config=cache_dir=${ghWorkSpace}/.ccache}`);
    await exec.exec(`ccache --set-config=max_size=${maxSize}`);
    await exec.exec(`ccache --set-config=compression=true`);
    core.info("Cccache config:");
    await exec.exec("ccache -p");
  } else {
    const options = `SCCACHE_IDLE_TIMEOUT=999999 SCCACHE_DIR="${ghWorkSpace}"/.sccache SCCACHE_CACHE_SIZE="${maxSize}"`
    await exec.exec(`env ${options} sccache --start-server`)
  }

}

async function run() : Promise<void> {
  try {
    const useSccache = core.getBooleanInput("sccache");
    const ccacheVariant = useSccache ? "sccache" : "ccache"
    core.saveState("ccacheVariant", ccacheVariant);
    let ccachePath = await io.which(ccacheVariant);
    if (!ccachePath) {
      core.info(`Install ${ccacheVariant}`);
      const installer = {
        ["ccache,linux"]: installCcacheLinux,
        ["ccache,darwin"]: installCcacheMac,
        ["ccache,win32"]: installCcacheWindows,
        ["sccache,linux"]: installSccacheLinux,
        ["sccache,darwin"]: installSccacheMac,
        ["sccache,win32"]: installSccacheWindows,
      }[[ccacheVariant, process.platform].join()]
      if (!installer) {
        throw Error(`Unsupported platform: ${process.platform}`)
      }
      await installer();
      core.info(await io.which(ccacheVariant + ".exe"))
      ccachePath = await io.which(ccacheVariant, true);
    }

    await restore(ccacheVariant);
    await configure(ccacheVariant);

    await exec.exec(`${ccacheVariant} -z`);
  } catch (error) {
    core.setFailed(`Restoring cache failed: ${error}`);
  }
}

async function installCcacheMac() {
  await exec.exec("brew install ccache");
}

async function installCcacheLinux() {
  await exec.exec("sudo apt-get install -y ccache");
}

async function installCcacheWindows() {
  throw Error("Ccache is not available for Windows, use Sccache with 'sccache: true'")
}

async function installSccacheMac() {
  await exec.exec("brew install sccache");
}

async function installSccacheLinux() {
  await installSccacheFromGitHub(
    "v0.2.15",
    "x86_64-unknown-linux-musl",
    "e5d03a9aa3b9fac7e490391bbe22d4f42c840d31ef9eaf127a03101930cbb7ca",
    "/usr/local/bin/",
    "sccache"
  );
}

async function installSccacheWindows() {
  await installSccacheFromGitHub(
    "v0.2.15",
    "x86_64-pc-windows-msvc",
    "e5d03a9aa3b9fac7e490391bbe22d4f42c840d31ef9eaf127a03101930cbb7ca",
    // TODO find a better place
    "C:\\Users\\runneradmin\\.cargo\\bin",
    "sccache.exe"
  );
}

async function installSccacheFromGitHub(version : string, artifactName : string, sha256 : string, binPath : string, binName : string) {
  const archiveName = `sccache-${version}-${artifactName}`
  const url = `https://github.com/mozilla/sccache/releases/download/${version}/${archiveName}.tar.gz`;
  await exec.exec("sh", ["-c", `curl -L '${url}' | tar xzf - -O '${archiveName}/${binName}' > '${binPath}/${binName}'`]);
  await exec.exec(`echo "${sha256}  ${binPath}/${binName}" | sha256sum -c`);
  await exec.exec(`chmod +x ${binPath}/${binName}`);
}


run();

export default run;
