/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, assert } from 'vitest';
import { normalizeMimeType } from 'vs/base/common/mime';
import { ensureNoDisposablesAreLeakedInTestSuite } from 'vs/base/test/common/utils';

describe('Mime', () => {
  it('normalize', () => {
    assert.strictEqual(normalizeMimeType('invalid'), 'invalid');
    assert.strictEqual(normalizeMimeType('invalid', true), undefined);
    assert.strictEqual(normalizeMimeType('Text/plain'), 'text/plain');
    assert.strictEqual(normalizeMimeType('Text/pläin'), 'text/pläin');
    assert.strictEqual(normalizeMimeType('Text/plain;UPPER'), 'text/plain;UPPER');
    assert.strictEqual(normalizeMimeType('Text/plain;lower'), 'text/plain;lower');
  });

  ensureNoDisposablesAreLeakedInTestSuite();
});
