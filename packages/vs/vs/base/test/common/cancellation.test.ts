/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, assert } from 'vitest';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { ensureNoDisposablesAreLeakedInTestSuite } from 'vs/base/test/common/utils';

describe('CancellationToken', function () {
  const store = ensureNoDisposablesAreLeakedInTestSuite();

  it('None', () => {
    assert.strictEqual(CancellationToken.None.isCancellationRequested, false);
    assert.strictEqual(typeof CancellationToken.None.onCancellationRequested, 'function');
  });

  it('cancel before token', function () {
    const source = new CancellationTokenSource();
    assert.strictEqual(source.token.isCancellationRequested, false);
    source.cancel();

    assert.strictEqual(source.token.isCancellationRequested, true);

    return new Promise<void>(resolve => {
      source.token.onCancellationRequested(() => resolve());
    });
  });

  it('cancel happens only once', function () {
    const source = new CancellationTokenSource();
    assert.strictEqual(source.token.isCancellationRequested, false);

    let cancelCount = 0;
    function onCancel() {
      cancelCount += 1;
    }

    store.add(source.token.onCancellationRequested(onCancel));

    source.cancel();
    source.cancel();

    assert.strictEqual(cancelCount, 1);
  });

  it('cancel calls all listeners', function () {
    let count = 0;

    const source = new CancellationTokenSource();
    store.add(source.token.onCancellationRequested(() => count++));
    store.add(source.token.onCancellationRequested(() => count++));
    store.add(source.token.onCancellationRequested(() => count++));

    source.cancel();
    assert.strictEqual(count, 3);
  });

  it('token stays the same', function () {
    let source = new CancellationTokenSource();
    let token = source.token;
    assert.ok(token === source.token); // doesn't change on get

    source.cancel();
    assert.ok(token === source.token); // doesn't change after cancel

    source.cancel();
    assert.ok(token === source.token); // doesn't change after 2nd cancel

    source = new CancellationTokenSource();
    source.cancel();
    token = source.token;
    assert.ok(token === source.token); // doesn't change on get
  });

  it('dispose calls no listeners', function () {
    let count = 0;

    const source = new CancellationTokenSource();
    store.add(source.token.onCancellationRequested(() => count++));

    source.dispose();
    source.cancel();
    assert.strictEqual(count, 0);
  });

  it('dispose calls no listeners (unless told to cancel)', function () {
    let count = 0;

    const source = new CancellationTokenSource();
    store.add(source.token.onCancellationRequested(() => count++));

    source.dispose(true);
    // source.cancel();
    assert.strictEqual(count, 1);
  });

  it('dispose does not cancel', function () {
    const source = new CancellationTokenSource();
    source.dispose();
    assert.strictEqual(source.token.isCancellationRequested, false);
  });

  it('parent cancels child', function () {
    const parent = new CancellationTokenSource();
    const child = new CancellationTokenSource(parent.token);

    let count = 0;
    store.add(child.token.onCancellationRequested(() => count++));

    parent.cancel();

    assert.strictEqual(count, 1);
    assert.strictEqual(child.token.isCancellationRequested, true);
    assert.strictEqual(parent.token.isCancellationRequested, true);

    child.dispose();
    parent.dispose();
  });
});
