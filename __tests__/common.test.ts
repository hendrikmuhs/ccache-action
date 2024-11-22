import * as common  from '../src/common';


describe('ccache common', () => {
    test('parse version string from ccache output', () => {
        const ccacheOutput = `ccache version 4.10.2
Features: avx2 file-storage http-storage redis+unix-storage redis-storage

Copyright (C) 2002-2007 Andrew Tridgell
Copyright (C) 2009-2024 Joel Rosdahl and other contributors

See <https://ccache.dev/credits.html> for a complete list of contributors.

This program is free software; etc etc.`;
        expect(common.parseCCacheVersion(ccacheOutput)).toStrictEqual([4,10,2]);
    });
});