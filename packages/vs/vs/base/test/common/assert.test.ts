/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, assert, it } from 'vitest';
import { ok } from 'vs/base/common/assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from 'vs/base/test/common/utils';

describe('Assert', () => {
  it('ok', () => {
    assert.throws(function () {
      ok(false);
    });

    assert.throws(function () {
      ok(null);
    });

    assert.throws(function () {
      ok();
    });

    assert.throws(
      function () {
        ok(null, 'Foo Bar');
      },
      Error, // Specifying the type of error expected
      /Foo Bar/, // Using a regular expression to match the error message
    );

    ok(true);
    ok('foo');
    ok({});
    ok(5);
  });

  ensureNoDisposablesAreLeakedInTestSuite();
});
