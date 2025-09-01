import { type Table, type Collection } from 'dexie';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export function fastForward<T extends object>(
  lastRow: T,
  primKey: keyof T | (keyof T)[],
  otherCriterion?: (item: T) => boolean,
): (item: T) => boolean {
  let fastForwardComplete = false;
  return (item: T) => {
    if (fastForwardComplete) {
      return otherCriterion ? otherCriterion(item) : true;
    }
    if (Array.isArray(primKey)) {
      const isMatch = primKey.every(key => item[key] === lastRow[key]);
      if (isMatch) {
        fastForwardComplete = true;
      }
    } else {
      if (item[primKey] === lastRow[primKey]) {
        fastForwardComplete = true;
      }
    }
    return false;
  };
}

export interface DexiePagerOptions<T extends { id?: unknown }, K = number> {
  table: Table<T, K>;
  index: keyof T & string;
  idProp?: keyof T & string;
  criterionFunction?: (item: T) => boolean;
  sortOrder?: SortOrder;
  pageSize?: number;
}

export class Pager<T extends { id?: unknown }, K = number> {
  private table: Table<T, K>;
  private index: keyof T & string;
  private idProp: keyof T & string;
  private criterionFunction?: (item: T) => boolean;
  private sortOrder: SortOrder;
  private pageSize: number;
  private lastEntry: T | null = null;
  private _done: boolean = false;

  constructor(options: DexiePagerOptions<T, K>) {
    const {
      table,
      index,
      criterionFunction = undefined,
      idProp = 'id', // Default to 'id'
      sortOrder = SortOrder.ASC,
      pageSize = 10,
    } = options;

    if (idProp !== table.schema.primKey.keyPath) {
      throw new Error(`Type T must have an 'id' property when idProp is not specified.`);
    }

    this.table = table;
    this.index = index;
    this.criterionFunction = criterionFunction;
    this.idProp = idProp;
    this.sortOrder = sortOrder;
    this.pageSize = pageSize;
  }

  get done() {
    return this._done;
  }

  async nextPage(): Promise<T[]> {
    if (this._done) return [];

    const applyFilters = (query: Collection<T, K>): Collection<T, K> => {
      if (this.criterionFunction) {
        query = query.filter(this.criterionFunction);
      }
      return query.limit(this.pageSize);
    };

    const applyFastForward = (query: Collection<T, K>): Collection<T, K> => {
      if (this.lastEntry) {
        query = query.filter(fastForward(this.lastEntry, this.idProp, this.criterionFunction));
      }
      return query.limit(this.pageSize);
    };

    let query: Collection<T, K>;

    if (this.sortOrder === SortOrder.ASC) {
      if (this.lastEntry) {
        query = this.table.where(this.index).aboveOrEqual(this.lastEntry[this.index]);
        query = applyFastForward(query);
      } else {
        query = this.table.orderBy(this.index);
        query = applyFilters(query);
      }
    } else {
      if (this.lastEntry) {
        query = this.table.where(this.index).belowOrEqual(this.lastEntry[this.index]).reverse();
        query = applyFastForward(query);
      } else {
        query = this.table.orderBy(this.index).reverse();
        query = applyFilters(query);
      }
    }

    const page = await query.toArray();

    if (page.length < this.pageSize) {
      this._done = true;
    }

    if (page.length > 0) {
      this.lastEntry = page[page.length - 1];
    }

    return page;
  }

  reset(): void {
    this.lastEntry = null;
    this._done = false;
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    this.reset();
    while (!this.done) {
      const page = await this.nextPage();
      for (const item of page) {
        yield item;
      }
    }
  }
}
