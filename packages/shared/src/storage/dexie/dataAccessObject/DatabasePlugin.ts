import { type Dexie } from 'dexie';
import { BaseDataAccessObject } from './BaseDataAccessObject';

export interface DatabasePlugin<T, K> {
  tableName: string;
  schema: { [version: number]: string };
  modelClass: new () => T;
  daoClass: new (db: Dexie) => BaseDataAccessObject<T, K>;
}
