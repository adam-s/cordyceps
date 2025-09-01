/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, it, assert } from 'vitest';
import { Emitter } from 'vs/base/common/event';
import {
  DisposableStore,
  dispose,
  IDisposable,
  markAsSingleton,
  ReferenceCollection,
  SafeDisposable,
  toDisposable,
} from 'vs/base/common/lifecycle';
import { ensureNoDisposablesAreLeakedInTestSuite, throwIfDisposablesAreLeaked } from 'vs/base/test/common/utils';

class Disposable implements IDisposable {
  isDisposed = false;
  dispose() {
    this.isDisposed = true;
  }
}

// Leaks are allowed here since we test lifecycle stuff:
describe('Lifecycle', () => {
  it('dispose single disposable', () => {
    const disposable = new Disposable();

    assert(!disposable.isDisposed);

    dispose(disposable);

    assert(disposable.isDisposed);
  });

  it('dispose disposable array', () => {
    const disposable = new Disposable();
    const disposable2 = new Disposable();

    assert(!disposable.isDisposed);
    assert(!disposable2.isDisposed);

    dispose([disposable, disposable2]);

    assert(disposable.isDisposed);
    assert(disposable2.isDisposed);
  });

  it('dispose disposables', () => {
    const disposable = new Disposable();
    const disposable2 = new Disposable();

    assert(!disposable.isDisposed);
    assert(!disposable2.isDisposed);

    dispose(disposable);
    dispose(disposable2);

    assert(disposable.isDisposed);
    assert(disposable2.isDisposed);
  });

  it('dispose array should dispose all if a child throws on dispose', () => {
    const disposedValues = new Set<number>();

    let thrownError: any;
    try {
      dispose([
        toDisposable(() => {
          disposedValues.add(1);
        }),
        toDisposable(() => {
          throw new Error('I am error');
        }),
        toDisposable(() => {
          disposedValues.add(3);
        }),
      ]);
    } catch (e) {
      thrownError = e;
    }

    assert.ok(disposedValues.has(1));
    assert.ok(disposedValues.has(3));
    assert.strictEqual(thrownError.message, 'I am error');
  });

  it('dispose array should rethrow composite error if multiple entries throw on dispose', () => {
    const disposedValues = new Set<number>();

    let thrownError: any;
    try {
      dispose([
        toDisposable(() => {
          disposedValues.add(1);
        }),
        toDisposable(() => {
          throw new Error('I am error 1');
        }),
        toDisposable(() => {
          throw new Error('I am error 2');
        }),
        toDisposable(() => {
          disposedValues.add(4);
        }),
      ]);
    } catch (e) {
      thrownError = e;
    }

    assert.ok(disposedValues.has(1));
    assert.ok(disposedValues.has(4));
    assert.ok(thrownError instanceof AggregateError);
    assert.strictEqual((thrownError as AggregateError).errors.length, 2);
    assert.strictEqual((thrownError as AggregateError).errors[0].message, 'I am error 1');
    assert.strictEqual((thrownError as AggregateError).errors[1].message, 'I am error 2');
  });

  it('Action bar has broken accessibility #100273', function () {
    const array = [{ dispose() {} }, { dispose() {} }];
    const array2 = dispose(array);

    assert.strictEqual(array.length, 2);
    assert.strictEqual(array2.length, 0);
    assert.ok(array !== array2);

    const set = new Set<IDisposable>([{ dispose() {} }, { dispose() {} }]);
    const setValues = set.values();
    const setValues2 = dispose(setValues);
    assert.ok(setValues === setValues2);
  });

  it('SafeDisposable, dispose', function () {
    let disposed = 0;
    const actual = () => (disposed += 1);
    const d = new SafeDisposable();
    d.set(actual);
    d.dispose();
    assert.strictEqual(disposed, 1);
  });

  it('SafeDisposable, unset', function () {
    let disposed = 0;
    const actual = () => (disposed += 1);
    const d = new SafeDisposable();
    d.set(actual);
    d.unset();
    d.dispose();
    assert.strictEqual(disposed, 0);
  });
});

describe('DisposableStore', () => {
  ensureNoDisposablesAreLeakedInTestSuite();

  it('dispose should call all child disposes even if a child throws on dispose', () => {
    const disposedValues = new Set<number>();

    const store = new DisposableStore();
    store.add(
      toDisposable(() => {
        disposedValues.add(1);
      }),
    );
    store.add(
      toDisposable(() => {
        throw new Error('I am error');
      }),
    );
    store.add(
      toDisposable(() => {
        disposedValues.add(3);
      }),
    );

    let thrownError: any;
    try {
      store.dispose();
    } catch (e) {
      thrownError = e;
    }

    assert.ok(disposedValues.has(1));
    assert.ok(disposedValues.has(3));
    assert.strictEqual(thrownError.message, 'I am error');
  });

  it('dispose should throw composite error if multiple children throw on dispose', () => {
    const disposedValues = new Set<number>();

    const store = new DisposableStore();
    store.add(
      toDisposable(() => {
        disposedValues.add(1);
      }),
    );
    store.add(
      toDisposable(() => {
        throw new Error('I am error 1');
      }),
    );
    store.add(
      toDisposable(() => {
        throw new Error('I am error 2');
      }),
    );
    store.add(
      toDisposable(() => {
        disposedValues.add(4);
      }),
    );

    let thrownError: any;
    try {
      store.dispose();
    } catch (e) {
      thrownError = e;
    }

    assert.ok(disposedValues.has(1));
    assert.ok(disposedValues.has(4));
    assert.ok(thrownError instanceof AggregateError);
    assert.strictEqual((thrownError as AggregateError).errors.length, 2);
    assert.strictEqual((thrownError as AggregateError).errors[0].message, 'I am error 1');
    assert.strictEqual((thrownError as AggregateError).errors[1].message, 'I am error 2');
  });

  it('delete should evict and dispose of the disposables', () => {
    const disposedValues = new Set<number>();
    const disposables: IDisposable[] = [
      toDisposable(() => {
        disposedValues.add(1);
      }),
      toDisposable(() => {
        disposedValues.add(2);
      }),
    ];

    const store = new DisposableStore();
    store.add(disposables[0]);
    store.add(disposables[1]);

    store.delete(disposables[0]);

    assert.ok(disposedValues.has(1));
    assert.ok(!disposedValues.has(2));

    store.dispose();

    assert.ok(disposedValues.has(1));
    assert.ok(disposedValues.has(2));
  });

  it('deleteAndLeak should evict and not dispose of the disposables', () => {
    const disposedValues = new Set<number>();
    const disposables: IDisposable[] = [
      toDisposable(() => {
        disposedValues.add(1);
      }),
      toDisposable(() => {
        disposedValues.add(2);
      }),
    ];

    const store = new DisposableStore();
    store.add(disposables[0]);
    store.add(disposables[1]);

    store.deleteAndLeak(disposables[0]);

    assert.ok(!disposedValues.has(1));
    assert.ok(!disposedValues.has(2));

    store.dispose();

    assert.ok(!disposedValues.has(1));
    assert.ok(disposedValues.has(2));

    disposables[0].dispose();
  });
});

describe('Reference Collection', () => {
  ensureNoDisposablesAreLeakedInTestSuite();

  class Collection extends ReferenceCollection<number> {
    private _count = 0;
    get count() {
      return this._count;
    }
    protected createReferencedObject(key: string): number {
      this._count++;
      return key.length;
    }
    protected destroyReferencedObject(key: string, object: number): void {
      this._count--;
    }
  }

  it('simple', () => {
    const collection = new Collection();

    const ref1 = collection.acquire('test');
    assert(ref1);
    assert.strictEqual(ref1.object, 4);
    assert.strictEqual(collection.count, 1);
    ref1.dispose();
    assert.strictEqual(collection.count, 0);

    const ref2 = collection.acquire('test');
    const ref3 = collection.acquire('test');
    assert.strictEqual(ref2.object, ref3.object);
    assert.strictEqual(collection.count, 1);

    const ref4 = collection.acquire('monkey');
    assert.strictEqual(ref4.object, 6);
    assert.strictEqual(collection.count, 2);

    ref2.dispose();
    assert.strictEqual(collection.count, 2);

    ref3.dispose();
    assert.strictEqual(collection.count, 1);

    ref4.dispose();
    assert.strictEqual(collection.count, 0);
  });
});

function assertThrows(fn: () => void, test: (error: any) => void) {
  try {
    fn();
    assert.fail('Expected function to throw, but it did not.');
  } catch (e: any) {
    assert.ok(test(e));
  }
}

describe('No Leakage Utilities', () => {
  describe('throwIfDisposablesAreLeaked', () => {
    it('throws if an event subscription is not cleaned up', () => {
      const eventEmitter = new Emitter();

      assertThrows(
        () => {
          throwIfDisposablesAreLeaked(() => {
            eventEmitter.event(() => {
              // noop
            });
          }, false);
        },
        e => e.message.indexOf('undisposed disposables') !== -1,
      );
    });

    it('throws if a disposable is not disposed', () => {
      assertThrows(
        () => {
          throwIfDisposablesAreLeaked(() => {
            new DisposableStore();
          }, false);
        },
        e => e.message.indexOf('undisposed disposables') !== -1,
      );
    });

    it('does not throw if all event subscriptions are cleaned up', () => {
      const eventEmitter = new Emitter();
      throwIfDisposablesAreLeaked(() => {
        eventEmitter
          .event(() => {
            // noop
          })
          .dispose();
      });
    });

    it('does not throw if all disposables are disposed', () => {
      // This disposable is reported before the test and not tracked.
      toDisposable(() => {});

      throwIfDisposablesAreLeaked(() => {
        // This disposable is marked as singleton
        markAsSingleton(toDisposable(() => {}));

        // These disposables are also marked as singleton
        const disposableStore = new DisposableStore();
        disposableStore.add(toDisposable(() => {}));
        markAsSingleton(disposableStore);

        toDisposable(() => {}).dispose();
      });
    });
  });

  describe('ensureNoDisposablesAreLeakedInTest', () => {
    ensureNoDisposablesAreLeakedInTestSuite();

    it('Basic Test', () => {
      toDisposable(() => {}).dispose();
    });
  });
});
