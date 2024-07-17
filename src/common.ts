import path from "path";

export function cacheDir(ccacheVariant: string): string {
    const ghWorkSpace = process.env.GITHUB_WORKSPACE || "unreachable, make ncc happy";
    if (ccacheVariant === "ccache") {
        return process.env.CCACHE_DIR || path.join(ghWorkSpace, ".ccache");
    } else if (ccacheVariant === "sccache") {
        return process.env.SCCACHE_DIR || path.join(ghWorkSpace, ".sccache");
    }
    throw Error("Unknown ccache variant: " + ccacheVariant);
}
