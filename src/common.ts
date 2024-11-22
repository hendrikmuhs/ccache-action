import path from "path";

type Version = [number,number,number];

export function parseCCacheVersion(ccacheOutput: string) : Version | null {
    const firstLine = ccacheOutput.split("\n", 1)[0];
    const semver = /(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/;
    const result = firstLine.match(semver);

    if (!result) {
        return null;
    }

    if (result.length != 4) {
        return null;
    }

    return [Number.parseInt(result[1]), Number.parseInt(result[2]), Number.parseInt(result[3])];
}

export function cacheDir(ccacheVariant: string): string {
    const ghWorkSpace = process.env.GITHUB_WORKSPACE || "unreachable, make ncc happy";
    if (ccacheVariant === "ccache") {
        return process.env.CCACHE_DIR || path.join(ghWorkSpace, ".ccache");
    } else if (ccacheVariant === "sccache") {
        return process.env.SCCACHE_DIR || path.join(ghWorkSpace, ".sccache");
    }
    throw Error("Unknown ccache variant: " + ccacheVariant);
}
