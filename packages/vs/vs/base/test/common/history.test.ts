/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { describe, it, assert } from 'vitest';
import { HistoryNavigator, HistoryNavigator2 } from 'vs/base/common/history';
import { ensureNoDisposablesAreLeakedInTestSuite } from 'vs/base/test/common/utils';

describe('History Navigator', () => {
  ensureNoDisposablesAreLeakedInTestSuite();

  it('create reduces the input to limit', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 2);

    assert.deepStrictEqual(['3', '4'], toArray(testObject));
  });

  it('create sets the position after last', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 100);

    assert.strictEqual(testObject.current(), null);
    assert.strictEqual(testObject.isNowhere(), true);
    assert.strictEqual(testObject.isFirst(), false);
    assert.strictEqual(testObject.isLast(), false);
    assert.strictEqual(testObject.next(), null);
    assert.strictEqual(testObject.previous(), '4');
    assert.strictEqual(testObject.isNowhere(), false);
    assert.strictEqual(testObject.isFirst(), false);
    assert.strictEqual(testObject.isLast(), true);
  });

  it('last returns last element', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 100);

    assert.strictEqual(testObject.first(), '1');
    assert.strictEqual(testObject.last(), '4');
    assert.strictEqual(testObject.isFirst(), false);
    assert.strictEqual(testObject.isLast(), true);
  });

  it('first returns first element', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 3);

    assert.strictEqual('2', testObject.first());
    assert.strictEqual(testObject.isFirst(), true);
    assert.strictEqual(testObject.isLast(), false);
  });

  it('next returns next element', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 3);

    testObject.first();

    assert.strictEqual(testObject.next(), '3');
    assert.strictEqual(testObject.next(), '4');
    assert.strictEqual(testObject.next(), null);
  });

  it('previous returns previous element', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 3);

    assert.strictEqual(testObject.previous(), '4');
    assert.strictEqual(testObject.previous(), '3');
    assert.strictEqual(testObject.previous(), '2');
    assert.strictEqual(testObject.previous(), null);
  });

  it('next on last element returns null and remains on last', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 3);

    testObject.first();
    testObject.last();

    assert.strictEqual(testObject.isLast(), true);
    assert.strictEqual(testObject.current(), '4');
    assert.strictEqual(testObject.next(), null);
    assert.strictEqual(testObject.isLast(), false); // Stepping past the last element, is no longer "last"
  });

  it('previous on first element returns null and remains on first', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 3);

    testObject.first();

    assert.strictEqual(testObject.isFirst(), true);
    assert.strictEqual(testObject.current(), '2');
    assert.strictEqual(testObject.previous(), null);
    assert.strictEqual(testObject.isFirst(), true);
  });

  it('add reduces the input to limit', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 2);

    testObject.add('5');

    assert.deepStrictEqual(toArray(testObject), ['4', '5']);
  });

  it('adding existing element changes the position', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 5);

    testObject.add('2');

    assert.deepStrictEqual(toArray(testObject), ['1', '3', '4', '2']);
  });

  it('add resets the navigator to last', () => {
    const testObject = new HistoryNavigator(['1', '2', '3', '4'], 3);

    testObject.first();
    testObject.add('5');

    assert.strictEqual(testObject.previous(), '5');
    assert.strictEqual(testObject.isLast(), true);
    assert.strictEqual(testObject.next(), null);
    assert.strictEqual(testObject.isLast(), false);
  });

  it('adding an existing item changes the order', () => {
    const testObject = new HistoryNavigator(['1', '2', '3']);

    testObject.add('1');

    assert.deepStrictEqual(['2', '3', '1'], toArray(testObject));
  });

  it('previous returns null if the current position is the first one', () => {
    const testObject = new HistoryNavigator(['1', '2', '3']);

    testObject.first();

    assert.deepStrictEqual(testObject.previous(), null);
    assert.strictEqual(testObject.isFirst(), true);
  });

  it('previous returns object if the current position is not the first one', () => {
    const testObject = new HistoryNavigator(['1', '2', '3']);

    testObject.first();
    testObject.next();

    assert.deepStrictEqual(testObject.previous(), '1');
  });

  it('next returns null if the current position is the last one', () => {
    const testObject = new HistoryNavigator(['1', '2', '3']);

    testObject.last();

    assert.strictEqual(testObject.isLast(), true);
    assert.deepStrictEqual(testObject.next(), null);
    assert.strictEqual(testObject.isLast(), false);
  });

  it('next returns object if the current position is not the last one', () => {
    const testObject = new HistoryNavigator(['1', '2', '3']);

    testObject.last();
    testObject.previous();

    assert.deepStrictEqual(testObject.next(), '3');
  });

  it('clear', () => {
    const testObject = new HistoryNavigator(['a', 'b', 'c']);
    assert.strictEqual(testObject.previous(), 'c');
    testObject.clear();
    assert.strictEqual(testObject.current(), null);
    assert.strictEqual(testObject.isNowhere(), true);
  });

  function toArray(historyNavigator: HistoryNavigator<string>): Array<string | null> {
    const result: Array<string | null> = [];
    historyNavigator.first();
    if (historyNavigator.current()) {
      do {
        result.push(historyNavigator.current()!);
      } while (historyNavigator.next());
    }
    return result;
  }
});

describe('History Navigator 2', () => {
  ensureNoDisposablesAreLeakedInTestSuite();

  it('constructor', () => {
    const testObject = new HistoryNavigator2(['1', '2', '3', '4']);

    assert.strictEqual(testObject.current(), '4');
    assert.strictEqual(testObject.isAtEnd(), true);
  });

  it('constructor - initial history is not empty', () => {
    assert.throws(() => new HistoryNavigator2([]));
  });

  it('constructor - capacity limit', () => {
    const testObject = new HistoryNavigator2(['1', '2', '3', '4'], 3);

    assert.strictEqual(testObject.current(), '4');
    assert.strictEqual(testObject.isAtEnd(), true);
    assert.strictEqual(testObject.has('1'), false);
  });

  it('constructor - duplicate values', () => {
    const testObject = new HistoryNavigator2(['1', '2', '3', '4', '3', '2', '1']);

    assert.strictEqual(testObject.current(), '1');
    assert.strictEqual(testObject.isAtEnd(), true);
  });

  it('navigation', () => {
    const testObject = new HistoryNavigator2(['1', '2', '3', '4']);

    assert.strictEqual(testObject.current(), '4');
    assert.strictEqual(testObject.isAtEnd(), true);

    assert.strictEqual(testObject.next(), '4');
    assert.strictEqual(testObject.previous(), '3');
    assert.strictEqual(testObject.previous(), '2');
    assert.strictEqual(testObject.previous(), '1');
    assert.strictEqual(testObject.previous(), '1');

    assert.strictEqual(testObject.current(), '1');
    assert.strictEqual(testObject.next(), '2');
    assert.strictEqual(testObject.resetCursor(), '4');
  });

  it('add', () => {
    const testObject = new HistoryNavigator2(['1', '2', '3', '4']);
    testObject.add('5');

    assert.strictEqual(testObject.current(), '5');
    assert.strictEqual(testObject.isAtEnd(), true);
  });

  it('add - existing value', () => {
    const testObject = new HistoryNavigator2(['1', '2', '3', '4']);
    testObject.add('2');

    assert.strictEqual(testObject.current(), '2');
    assert.strictEqual(testObject.isAtEnd(), true);

    assert.strictEqual(testObject.previous(), '4');
    assert.strictEqual(testObject.previous(), '3');
    assert.strictEqual(testObject.previous(), '1');
  });

  it('replaceLast', () => {
    const testObject = new HistoryNavigator2(['1', '2', '3', '4']);
    testObject.replaceLast('5');

    assert.strictEqual(testObject.current(), '5');
    assert.strictEqual(testObject.isAtEnd(), true);
    assert.strictEqual(testObject.has('4'), false);

    assert.strictEqual(testObject.previous(), '3');
    assert.strictEqual(testObject.previous(), '2');
    assert.strictEqual(testObject.previous(), '1');
  });

  it('replaceLast - existing value', () => {
    const testObject = new HistoryNavigator2(['1', '2', '3', '4']);
    testObject.replaceLast('2');

    assert.strictEqual(testObject.current(), '2');
    assert.strictEqual(testObject.isAtEnd(), true);
    assert.strictEqual(testObject.has('4'), false);

    assert.strictEqual(testObject.previous(), '3');
    assert.strictEqual(testObject.previous(), '1');
  });

  it('prepend', () => {
    const testObject = new HistoryNavigator2(['1', '2', '3', '4']);
    assert.strictEqual(testObject.current(), '4');
    assert.ok(testObject.isAtEnd());
    assert.deepStrictEqual(Array.from(testObject), ['1', '2', '3', '4']);

    testObject.prepend('0');
    assert.strictEqual(testObject.current(), '4');
    assert.ok(testObject.isAtEnd());
    assert.deepStrictEqual(Array.from(testObject), ['0', '1', '2', '3', '4']);

    testObject.prepend('2');
    assert.strictEqual(testObject.current(), '4');
    assert.ok(testObject.isAtEnd());
    assert.deepStrictEqual(Array.from(testObject), ['0', '1', '2', '3', '4']);
  });
});
