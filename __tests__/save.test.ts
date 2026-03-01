import {jest, describe, test, expect, beforeEach} from "@jest/globals";

const mockExec = jest.fn<(...args: unknown[]) => Promise<number>>().mockResolvedValue(0);

jest.unstable_mockModule("@actions/exec", () => ({
    exec: mockExec,
    getExecOutput: jest.fn(),
}));

jest.unstable_mockModule("@actions/cache", () => ({
    saveCache: jest.fn(),
    restoreCache: jest.fn(),
    isFeatureAvailable: jest.fn(),
}));

const summaryMock = {
    addHeading: jest.fn().mockReturnThis(),
    addTable: jest.fn().mockReturnThis(),
    write: jest.fn().mockReturnThis(),
};

jest.unstable_mockModule("@actions/core", () => ({
    exportVariable: jest.fn(),
    setSecret: jest.fn(),
    addPath: jest.fn(),
    getInput: jest.fn(),
    getMultilineInput: jest.fn(),
    getBooleanInput: jest.fn(),
    setOutput: jest.fn(),
    setCommandEcho: jest.fn(),
    setFailed: jest.fn(),
    isDebug: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    notice: jest.fn(),
    info: jest.fn(),
    startGroup: jest.fn(),
    endGroup: jest.fn(),
    group: jest.fn(),
    saveState: jest.fn(),
    getState: jest.fn(),
    getIDToken: jest.fn(),
    summary: summaryMock,
    markdownSummary: summaryMock,
    toPosixPath: jest.fn(),
    toWin32Path: jest.fn(),
    toPlatformPath: jest.fn(),
    platform: {},
}));

const {AgeUnit} = await import("../src/common");
const save = await import("../src/save");

describe('ccache save', () => {
    beforeEach(() => {
        mockExec.mockClear();
    });

    test('evict old files from the cache by age in seconds', async () => {
        const ageInSeconds = 42;
        await save.evictOldFiles(ageInSeconds, AgeUnit.Seconds);
        expect(mockExec).toHaveBeenCalledWith(`ccache --evict-older-than ${ageInSeconds}s`);
    });

    test('evict old files from the cache by age in days', async () => {
        const ageInDays = 3;
        await save.evictOldFiles(ageInDays, AgeUnit.Days);
        expect(mockExec).toHaveBeenCalledWith(`ccache --evict-older-than ${ageInDays}d`);
    });
});
