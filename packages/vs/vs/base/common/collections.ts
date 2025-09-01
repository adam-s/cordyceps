/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * An interface for a JavaScript object that
 * acts a dictionary. The keys are strings.
 */
export type IStringDictionary<V> = Record<string, V>;

/**
 * An interface for a JavaScript object that
 * acts a dictionary. The keys are numbers.
 */
export type INumberDictionary<V> = Record<number, V>;

/**
 * Groups the collection into a dictionary based on the provided
 * group function.
 */
export function groupBy<K extends string | number | symbol, V>(
  data: V[],
  groupFn: (element: V) => K,
): Record<K, V[]> {
  const result: Record<K, V[]> = Object.create(null);
  for (const element of data) {
    const key = groupFn(element);
    let target = result[key];
    if (!target) {
      target = result[key] = [];
    }
    target.push(element);
  }
  return result;
}

export function diffSets<T>(before: Set<T>, after: Set<T>): { removed: T[]; added: T[] } {
  const removed: T[] = [];
  const added: T[] = [];
  for (const element of before) {
    if (!after.has(element)) {
      removed.push(element);
    }
  }
  for (const element of after) {
    if (!before.has(element)) {
      added.push(element);
    }
  }
  return { removed, added };
}

export function diffMaps<K, V>(before: Map<K, V>, after: Map<K, V>): { removed: V[]; added: V[] } {
  const removed: V[] = [];
  const added: V[] = [];
  for (const [index, value] of before) {
    if (!after.has(index)) {
      removed.push(value);
    }
  }
  for (const [index, value] of after) {
    if (!before.has(index)) {
      added.push(value);
    }
  }
  return { removed, added };
}

/**
 * Computes the intersection of two sets.
 *
 * @param setA - The first set.
 * @param setB - The second iterable.
 * @returns A new set containing the elements that are in both `setA` and `setB`.
 */
export function intersection<T>(setA: Set<T>, setB: Iterable<T>): Set<T> {
  const result = new Set<T>();
  for (const elem of setB) {
    if (setA.has(elem)) {
      result.add(elem);
    }
  }
  return result;
}

export class SetWithKey<T> extends Set<T> {
  private _map = new Map<unknown, T>();

  constructor(
    values: T[],
    private toKey: (t: T) => unknown,
  ) {
    super();
    for (const v of values) {
      this.add(v);
    }
  }

  override get size(): number {
    return this._map.size;
  }

  override add(value: T): this {
    this._map.set(this.toKey(value), value);
    return this;
  }

  override delete(value: T): boolean {
    return this._map.delete(this.toKey(value));
  }

  override has(value: T): boolean {
    return this._map.has(this.toKey(value));
  }

  override entries(): ReturnType<Set<T>['entries']> {
    // To return an iterator of [T, T] pairs (SetIterator<[T, T]>),
    // we create a temporary Set<T> from our stored values and call its .entries() method.
    return new Set(this._map.values()).entries();
  }

  override keys(): ReturnType<Set<T>['keys']> {
    return new Set(this._map.values()).keys();
  }

  override values(): ReturnType<Set<T>['values']> {
    return new Set(this._map.values()).values();
  }

  override clear(): void {
    this._map.clear();
  }

  override forEach(
    callbackfn: (value: T, value2: T, set: Set<T>) => void,
    thisArg?: unknown,
  ): void {
    this._map.forEach(value => callbackfn.call(thisArg, value, value, this));
  }

  override [Symbol.iterator](): ReturnType<Set<T>['values']> {
    return new Set(this._map.values()).values();
  }

  override [Symbol.toStringTag] = 'SetWithKey';
}
