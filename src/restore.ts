import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import * as core from "@actions/core";
import * as io from "@actions/io";
import * as exec from "@actions/exec";
import * as process from "process";
import * as cache from "@actions/cache";
import { cacheDir } from "./common";

export enum VARIANT {
  SCCACHE = "sccache",
  CCACHE = "ccache",
}

export enum ARCH {
  X86_64 = "x86_64",
  AARCH64 = "aarch64",
}

export enum PLATFORM {
  LINUX = "linux",
  WINDOWS = "windows",
  DARWIN = "darwin",
}

export enum INSTALL_METHOD {
  YES = "yes",
  BINARY = "binary",
  DETECT = "detect",
  NO = "no"
}

interface PackageMetadata {
  url: string;
  sha256: string;
  dir: string;
  artifact: string;
}
export class Package {
  constructor(
    public readonly variant: VARIANT,
    public readonly arch: ARCH,
    public readonly platform: PLATFORM,
    private readonly metadata: PackageMetadata) { }

  get packageName(): string {
    return this.metadata.dir
  }

  get downloadUrl(): string {
    return this.metadata.url
  }

  get sha256(): string {
    return this.metadata.sha256
  }

  get artifact(): string {
    return this.metadata.artifact
  }

  async downloadAndExtract(srcFile: string, dstFile: string) {
    const dstDir = path.dirname(dstFile);
    if (!fs.existsSync(dstDir)) {
      fs.mkdirSync(dstDir, { recursive: true });
    }

    const url = this.downloadUrl

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ccache"));
    const dlName = path.join(tmp, this.artifact)
    await execShell(`curl -L '${url}' -o '${dlName}'`)

    if (url.endsWith(".zip")) {
      await execShell(`unzip '${dlName}' -d '${tmp}'`)
      fs.copyFileSync(path.join(tmp, srcFile), dstFile)
      fs.rmSync(tmp, { recursive: true })
    } else {
      // windows is a little special :)
      if (this.platform === PLATFORM.WINDOWS) {
        const winName = dlName.replaceAll('\\', '/')
        await execShell(`tar xf "$(cygpath -u ${winName})" -O '${srcFile}' > '${dstFile}'`)
      }
      else
        await execShell(`tar xf '${dlName}' -O '${srcFile}' > '${dstFile}'`)
    }
  }

  /**
   * Install the package.
   */
  async installBinary(): Promise<void> {
    const isWindows = this.platform === PLATFORM.WINDOWS;

    const binDir = isWindows
      ? path.join(process.env.USERPROFILE!, ".cargo", "bin")
      : "/usr/local/bin";

    // Also prepend install path to PATH var
    // To prevent pre-existing install potentially clobbering this one
    core.addPath(binDir);

    const binName = isWindows ? `${this.variant}.exe` : this.variant;
    const binPath = path.join(binDir, binName);

    await this.downloadAndExtract(
      `${this.packageName}/${binName}`,
      binPath);

    checkSha256Sum(binPath, this.sha256);

    await execShell(`chmod +x '${binPath}'`);
  }

  /**
   * Attempt to install this package from the package manager.
   * @returns Whether or not it was successfully installed.
   */
  async installPackageManager(): Promise<boolean> {
    const shouldUpdate = core.getBooleanInput("update-package-index");
    const pkg: string = this.variant

    let updateCmd
    let installCmd
    let needSudo = false

    // some distros don't have sccache
    let hasSccache = true

    switch (this.platform) {
      case PLATFORM.DARWIN:
        updateCmd = "brew update"
        installCmd = "brew install"
        break
      case PLATFORM.LINUX:
        if (await io.which("apt-get")) {
          updateCmd = "apt-get update"
          installCmd = "apt-get install -y"
          hasSccache = false
          needSudo = true
        } else if (await io.which("apk")) {
          updateCmd = "apk update"
          installCmd = "apk add"
          hasSccache = false
        } else if (await io.which("dnf")) {
          updateCmd = "dnf check-update"
          installCmd = "dnf install -y"

          // ccache needs epel repo
          await execShell(`${installCmd} epel-release`)
        } else if (await io.which("pacman")) {
          // arch frequently upgrades glibc and such
          // partial updates will break things if you don't pass -u!
          updateCmd = "pacman -Syu --noconfirm --needed"
          installCmd = "pacman -S --noconfirm --needed"
        }
        break
      case PLATFORM.WINDOWS:
        // Windows doesn't have a good package manager
        // Well, it has chocolatey, but it doesn't work right with ARM
        return false
    }

    if (pkg === VARIANT.SCCACHE && !hasSccache) return false

    let execFunc = needSudo ? execShellSudo : execShell

    try {
      if (shouldUpdate) await execFunc(`${updateCmd}`)
      await execFunc(`${installCmd} ${pkg}`)
    } catch (error) {
      throw new Error(getPackageManagerError(error));
    }

    return Boolean(await io.which(pkg))
  }

  async installAuto(): Promise<void> {
    if (!await this.installPackageManager()) {
      await this.installBinary()
    }
  }

  async install(method: INSTALL_METHOD): Promise<void> {
    switch (method) {
      case INSTALL_METHOD.YES:
        await this.installAuto()
        break
      case INSTALL_METHOD.BINARY:
        await this.installBinary()
        break
      case INSTALL_METHOD.DETECT:
        if (!await io.which(this.variant)) await this.installAuto()
        break
      case INSTALL_METHOD.NO:
      default:
        break
    }

    if (!await io.which(this.variant)) {
      throw new Error(`Unable to install ${this.variant}. Check prior logs and file a bug report.`)
    }
  }
}

// platform/stuff helpers //
function detectPlatform(): PLATFORM {
  switch (process.platform) {
    case "linux":
      return PLATFORM.LINUX;
    case "win32":
      return PLATFORM.WINDOWS;
    case "darwin":
      return PLATFORM.DARWIN;
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function detectArchKey(): "x86_64" | "aarch64" {
  switch (process.arch) {
    case "x64":
      return "x86_64";
    case "arm64":
      return "aarch64";
    default:
      throw new Error(`Unsupported architecture: ${process.arch}`);
  }
}

export function selectPackage(variant: VARIANT): Package {
  const platform = detectPlatform()
  const archKey = detectArchKey()

  const metadataPath = path.join(__dirname, 'metadata.json');

  if (!fs.existsSync(metadataPath)) {
    throw new Error(`metadata file not found at ${metadataPath}`);
  }

  const rawData = fs.readFileSync(metadataPath, 'utf-8');
  const allMetadata = JSON.parse(rawData);

  const entry: PackageMetadata = allMetadata[variant]?.[archKey]?.[platform];

  if (!entry) {
    throw new Error(
      `No metadata found for combination: variant=${variant}, arch=${archKey}, platform=${platform}`
    );
  }

  return new Package(variant, archKey as ARCH, platform as PLATFORM, entry);
}

export function selectMethod(method: string): INSTALL_METHOD {
  switch (method) {
    case "yes": return INSTALL_METHOD.YES
    case "binary": return INSTALL_METHOD.BINARY
    case "detect": return INSTALL_METHOD.DETECT
    case "no": return INSTALL_METHOD.NO
    default: throw new Error(`Unsupported installation method ${method}.`)
  }
}

export function selectVariant(variant: string): VARIANT {
  switch (variant) {
    case "sccache": return VARIANT.SCCACHE
    case "ccache": return VARIANT.CCACHE
    default: throw new Error(`Unsupported ccache variant ${variant}.`)
  }
}

const SELF_CI = process.env["CCACHE_ACTION_CI"] === "true"

function getPackageManagerError(error: Error | unknown): string {
  return (
    `Failed to install ccache via package manager: '${error}'. ` +
    "Perhaps package manager index is not up to date? " +
    "(either update it manually before running ccache-action or set 'update-package-index' option to 'true')"
  );
}

// based on https://cristianadam.eu/20200113/speeding-up-c-plus-plus-github-actions-using-ccache/

async function restore(ccacheVariant: string): Promise<void> {
  const inputs = {
    primaryKey: core.getInput("key"),
    // https://github.com/actions/cache/blob/73cb7e04054996a98d39095c0b7821a73fb5b3ea/src/utils/actionUtils.ts#L56
    restoreKeys: core.getInput("restore-keys").split("\n").map(s => s.trim()).filter(x => x !== ""),
    appendTimestamp: core.getInput("append-timestamp")
  };

  const keyPrefix = ccacheVariant + "-";
  const primaryKey = inputs.primaryKey ? keyPrefix + (inputs.appendTimestamp ? inputs.primaryKey + "-" : inputs.primaryKey) : keyPrefix;
  const restoreKeys = inputs.restoreKeys.map(k => keyPrefix + k + (inputs.appendTimestamp ? "-" : ""));
  const paths = [cacheDir(ccacheVariant)];

  core.saveState("primaryKey", primaryKey);

  const shouldRestore = core.getBooleanInput("restore");
  if (!shouldRestore) {
    core.info("Restore set to false, skip restoring cache.");
    return;
  }
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

async function configure(ccacheVariant: string, platform: string): Promise<void> {
  const maxSize = core.getInput('max-size');

  if (ccacheVariant === "ccache") {
    await execShell(`ccache --set-config=cache_dir='${cacheDir(ccacheVariant)}'`);
    await execShell(`ccache --set-config=max_size='${maxSize}'`);
    await execShell(`ccache --set-config=compression=true`);
    if (platform === "darwin" || platform === "win32") {
      // On Windows mtime will be different depending on the Visual Studio installation time, making it unreliable.
      await execShell(`ccache --set-config=compiler_check=content`);
    }
    if (core.getBooleanInput("create-symlink")) {
      const ccache = await io.which("ccache");
      await execShell(`ln -s ${ccache} /usr/local/bin/gcc`);
      await execShell(`ln -s ${ccache} /usr/local/bin/g++`);
      await execShell(`ln -s ${ccache} /usr/local/bin/cc`);
      await execShell(`ln -s ${ccache} /usr/local/bin/c++`);
      await execShell(`ln -s ${ccache} /usr/local/bin/clang`);
      await execShell(`ln -s ${ccache} /usr/local/bin/clang++`);
      await execShell(`ln -s ${ccache} /usr/local/bin/emcc`);
      await execShell(`ln -s ${ccache} /usr/local/bin/em++`);
    }
    if (core.getBooleanInput("debug")) {
      // This enables CCache's debug mode, and later uploads an artifact containing that debug info.
      core.exportVariable("CCACHE_DEBUG", true);

      const debugDir = (process.platform === "win32" ?
        process.env.USERPROFILE! :
        process.env.HOME) + "/.ccache-debug"

      io.mkdirP(debugDir)
      core.exportVariable("CCACHE_DEBUGDIR", debugDir)
    }
    core.info("Ccache config:");
    await execShell("ccache -p");
  } else {
    const options = `SCCACHE_IDLE_TIMEOUT=0 SCCACHE_DIR='${cacheDir(ccacheVariant)}' SCCACHE_CACHE_SIZE='${maxSize}'`;
    await execShell(`env ${options} sccache --start-server`);
  }
}

async function execShell(cmd: string) {
  await exec.exec("sh", ["-xc", cmd]);
}

async function execShellSudo(cmd: string) {
  // if no sudo is available we are probably in a docker container, and don't need it anyways
  if (await io.which("sudo")) await execShell("$(which sudo) " + cmd);
  else await execShell(cmd);
}

function checkSha256Sum(path: string, expectedSha256: string) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(path));
  const actualSha256 = h.digest("hex");
  if (actualSha256 !== expectedSha256) {
    throw Error(`SHA256 of ${path} is ${actualSha256}, expected ${expectedSha256}`);
  }
}

async function runInner(): Promise<void> {
  const ccacheVariant = core.getInput("variant");
  const installMethod = core.getInput("install");
  core.saveState("startTimestamp", Date.now());
  core.saveState("ccacheVariant", ccacheVariant);
  core.saveState("evictOldFiles", core.getInput("evict-old-files"));
  core.saveState("shouldSave", core.getBooleanInput("save"));
  core.saveState("appendTimestamp", core.getBooleanInput("append-timestamp"));

  core.startGroup(`Install ${ccacheVariant}`);

  const variant = selectVariant(ccacheVariant)
  const pkg = selectPackage(variant)
  const method = selectMethod(installMethod);

  await pkg.install(method);

  let ccachePath = await io.which(ccacheVariant, true);
  core.info(`${ccacheVariant} installed at ${ccachePath}`)
  core.endGroup();

  core.startGroup("Restore cache");
  await restore(ccacheVariant);
  core.endGroup();

  core.startGroup(`Configure ${ccacheVariant}, ${process.platform}`);
  await configure(ccacheVariant, process.platform);
  await execShell(`${ccacheVariant} -z`);
  core.endGroup();
}

async function run(): Promise<void> {
  try {
    await runInner();
  } catch (error) {
    core.setFailed(`Restoring cache failed: ${error}`);
  }
}

run();

export default run;
