import {AgeUnit} from "../src/common";
import * as save  from '../src/save';
import * as exec from "@actions/exec";

jest.mock("@actions/exec");

describe('ccache save', () => {
    test('evict old files from the cache by age in seconds', async () => {
        const proc = jest.spyOn(exec, "exec");

        const ageInSeconds = 42;
        await save.evictOldFiles(ageInSeconds, AgeUnit.Seconds);
        expect(proc).toHaveBeenCalledWith(`ccache --evict-older-than ${ageInSeconds}s`);
    });

    test('evict old files from the cache by age in days', async () => {
        const proc = jest.spyOn(exec, "exec");

        const ageInDays = 3;
        await save.evictOldFiles(ageInDays, AgeUnit.Days);
        expect(proc).toHaveBeenCalledWith(`ccache --evict-older-than ${ageInDays}d`);
    });
});
