// UserDataAccessObject.ts
import { BaseDataAccessObject } from '@shared/storage/dexie/dataAccessObject/BaseDataAccessObject';
import { DatabasePlugin } from '@shared/storage/dexie/dataAccessObject/DatabasePlugin';
import { Dexie, type Table } from 'dexie';

export const userSchema = {
  1: '++id, username',
};

export interface IUserModel {
  id: string;
  username: string;
  profileUrl?: string;
}

export class UserDataAccessObject extends BaseDataAccessObject<IUserModel, string> {
  constructor(db: Dexie) {
    super(db.table('users'), 'users');
  }

  get table(): Table {
    return this._table;
  }

  public async findAllAsync(): Promise<IUserModel[]> {
    return this.getAll();
  }

  public async findByIdAsync(id: string): Promise<IUserModel | undefined> {
    return this.get(id);
  }

  static plugin: DatabasePlugin<IUserModel, string> = {
    tableName: 'users',
    schema: userSchema,
    modelClass: class UserModel implements IUserModel {
      id!: string;
      username!: string;
      profileUrl?: string;
    },
    daoClass: UserDataAccessObject,
  };
}
