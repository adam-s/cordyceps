import { type Table, type UpdateSpec } from 'dexie';

export abstract class BaseDataAccessObject<T, K> {
  protected _table: Table<T, K, T>;
  public tableName = '';

  constructor(table: Table<T, K, T>, tableName: string) {
    this._table = table;
    this.tableName = tableName;
  }

  async add(item: T): Promise<K> {
    return this._table.add(item);
  }

  async get(id: K): Promise<T | undefined> {
    return this._table.get(id);
  }

  async getAll(): Promise<T[]> {
    return this._table.toArray();
  }

  async update(id: K, changes: UpdateSpec<T>): Promise<number> {
    return this._table.update(id, changes);
  }

  async delete(id: K): Promise<void> {
    await this._table.delete(id);
  }

  async count(): Promise<number> {
    return this._table.count();
  }
}
