import * as save  from '../src/save';
import * as exec from "@actions/exec";

jest.mock("@actions/exec");

describe('ccache save', () => {
    test('evict old files from the cache', async () => {
        const proc = jest.spyOn(exec, "exec");

        const ageInSeconds = 42;
        await save.evictOldFiles(ageInSeconds);
        expect(proc).toHaveBeenCalledWith(`ccache --evict-older-than ${ageInSeconds}s`);
    });
});
