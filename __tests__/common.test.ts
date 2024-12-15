import * as common  from '../src/common';
import * as core from "@actions/core";

describe('ccache common', () => {
    test('get duration of job in seconds', () => {
        const stateMock = jest.spyOn(core, "getState");
        const expectedAgeInSeconds = 1234;
        const startTimeMs = 1734258917128;
        const endTimeMs = startTimeMs + expectedAgeInSeconds * 1000;
        stateMock.mockImplementationOnce(() => startTimeMs.toString());
        jest.useFakeTimers().setSystemTime(new Date(endTimeMs));

        const age = common.getJobDurationInSeconds();
        expect(stateMock).toHaveBeenCalledWith("startTimestamp");
        expect(age).toBe(expectedAgeInSeconds);
    });

    test('parse version string from ccache output', () => {
        const ccacheOutput = `ccache version 4.10.2
Features: avx2 file-storage http-storage redis+unix-storage redis-storage

Copyright (C) 2002-2007 Andrew Tridgell
Copyright (C) 2009-2024 Joel Rosdahl and other contributors

See <https://ccache.dev/credits.html> for a complete list of contributors.

This program is free software; etc etc.`;
        expect(common.parseCCacheVersion(ccacheOutput)).toStrictEqual([4, 10, 2]);
    });

    test('format JSON stats output as table data', () => {
        const stats = `{
          "autoconf_test": 0,
          "bad_compiler_arguments": 0,
          "bad_input_file": 0,
          "bad_output_file": 0,
          "cache_miss": 3965,
          "cache_size_kibibyte": 3511716,
          "called_for_link": 0,
          "called_for_preprocessing": 0,
          "cleanups_performed": 0,
          "compile_failed": 0,
          "compiler_check_failed": 0,
          "compiler_produced_empty_output": 0,
          "compiler_produced_no_output": 0,
          "compiler_produced_stdout": 0,
          "could_not_find_compiler": 0,
          "could_not_use_modules": 0,
          "could_not_use_precompiled_header": 0,
          "direct_cache_hit": 254,
          "direct_cache_miss": 3965,
          "disabled": 0,
          "error_hashing_extra_file": 0,
          "files_in_cache": 16868,
          "internal_error": 0,
          "local_storage_hit": 254,
          "local_storage_miss": 3965,
          "local_storage_read_hit": 508,
          "local_storage_read_miss": 7930,
          "local_storage_write": 7930,
          "max_cache_size_kibibyte": 5242880,
          "max_files_in_cache": 0,
          "missing_cache_file": 0,
          "modified_input_file": 0,
          "multiple_source_files": 0,
          "no_input_file": 0,
          "output_to_stdout": 0,
          "preprocessed_cache_hit": 0,
          "preprocessed_cache_miss": 3965,
          "preprocessor_error": 0,
          "recache": 0,
          "remote_storage_error": 0,
          "remote_storage_hit": 0,
          "remote_storage_miss": 0,
          "remote_storage_read_hit": 0,
          "remote_storage_read_miss": 0,
          "remote_storage_timeout": 0,
          "remote_storage_write": 0,
          "stats_updated_timestamp": 1732222833,
          "stats_zeroed_timestamp": 1732201768,
          "unsupported_code_directive": 0,
          "unsupported_compiler_option": 0,
          "unsupported_environment_variable": 0,
          "unsupported_source_language": 0
        }`
        expect(common.formatStatsAsTable(stats)).toStrictEqual([[
            {data: "Cache hits", header: true }, "254 / 4219", "6.02%"
        ]]);
    })
});
