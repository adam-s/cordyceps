import { generateUuid } from 'vs/base/common/uuid';
import { IUserModel, UserDataAccessObject } from './UserDataAccessObject';
import { ILogService } from '@shared/services/log.service';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { SortOrder, Pager } from '@shared/storage/dexie/dataAccessObject/Pager';

export interface IUserService {
  _serviceBrand: undefined;
}

export const IUserService = createDecorator<IUserService>('userService');

export class UserService implements IUserService {
  readonly _serviceBrand: undefined;

  constructor(
    private readonly _logService: ILogService,
    private readonly _userDAO: UserDataAccessObject,
  ) {}

  async start(): Promise<void> {
    // Initialization if necessary
  }

  async createUser(username: string): Promise<string> {
    const id = generateUuid().toString();
    const user: IUserModel = { id, username };
    await this._userDAO.add(user);
    return id;
  }

  async getUser(id: string): Promise<IUserModel | undefined> {
    return this._userDAO.get(id);
  }

  async updateUser(id: string, updates: Partial<IUserModel>): Promise<void> {
    await this._userDAO.update(id, updates);
  }

  async deleteUser(id: string): Promise<void> {
    await this._userDAO.delete(id);
  }

  async listUsers(
    query: Partial<Record<keyof IUserModel, unknown>> = {},
    options?: { pageSize?: number; sortOrder?: SortOrder },
  ): Promise<IUserModel[]> {
    const { pageSize = 10, sortOrder = SortOrder.ASC } = options || {};

    // Create a criterion function based on the query
    const criterionFunction = (user: IUserModel) => {
      return (Object.keys(query) as (keyof IUserModel)[]).every(key => user[key] === query[key]);
    };

    // Create an instance of Pager
    const pager = new Pager<IUserModel>({
      table: this._userDAO.table, // Assuming userDAO has a 'table' property
      index: 'id', // Or another appropriate index
      idProp: 'id',
      criterionFunction,
      sortOrder,
      pageSize,
    });

    // Fetch the first page
    const page = await pager.nextPage();

    return page;
  }

  public async findAllAsync(): Promise<IUserModel[]> {
    return this.listUsers({});
  }

  public async findByIdAsync(id: string): Promise<IUserModel | undefined> {
    return this.getUser(id);
  }
}
