import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { SortOrder } from '@shared/storage/dexie/dataAccessObject/Pager';
import { IUserModel, UserDataAccessObject } from '../user/UserDataAccessObject';
import { ILogService, LogLevel } from '@shared/services/log.service';
import { UserService } from '../user/user.service';
import * as uuid from 'vs/base/common/uuid';

// Define a mock database
class MyDatabase extends Dexie {
  users!: Dexie.Table<IUserModel, string>;

  constructor() {
    super('MyDatabase');
    this.version(1).stores({
      users: '++id, username',
    });
  }
}

describe('UserService', () => {
  let db: MyDatabase;
  let logService: ILogService;
  let userDAO: UserDataAccessObject;
  let userService: UserService;

  beforeEach(async () => {
    // Initialize the database
    db = new MyDatabase();

    // Clear the table before each test to ensure test isolation
    await db.users.clear();

    // Populate the database with sample data
    await db.users.bulkAdd([
      { id: '1', username: 'user1' },
      { id: '2', username: 'user2' },
      { id: '3', username: 'user3' },
    ]);

    logService = {
      _serviceBrand: undefined,
      level: LogLevel.Info,
      setLevel: vi.fn(),
      log: vi.fn(),
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    userDAO = new UserDataAccessObject(db);
    userService = new UserService(logService, userDAO);
  });

  it('should create a user and return its ID', async () => {
    const username = 'testuser';
    const mockId = 'uuid-1234';
    vi.spyOn(uuid, 'generateUuid').mockReturnValue(mockId);

    const id = await userService.createUser(username);

    const user = await db.users.get(mockId);
    expect(id).toBe(mockId);
    expect(user).toEqual({ id: mockId, username });
  });

  it('should retrieve a user by ID', async () => {
    const user = await userService.getUser('1');
    expect(user).toEqual({ id: '1', username: 'user1' });
  });

  it('should update a user', async () => {
    await userService.updateUser('1', { username: 'updatedUser' });

    const user = await db.users.get('1');
    expect(user).toEqual({ id: '1', username: 'updatedUser' });
  });

  it('should delete a user by ID', async () => {
    await userService.deleteUser('1');

    const user = await db.users.get('1');
    expect(user).toBeUndefined();
  });

  it('should list users with default options', async () => {
    const users = await userService.listUsers();

    expect(users.length).toBe(3);
    expect(users).toEqual([
      { id: '1', username: 'user1' },
      { id: '2', username: 'user2' },
      { id: '3', username: 'user3' },
    ]);
  });

  it('should list users with query and options', async () => {
    const query = { username: 'user1' };
    const options = { pageSize: 5, sortOrder: SortOrder.DESC };

    const users = await userService.listUsers(query, options);

    expect(users.length).toBe(1);
    expect(users).toEqual([{ id: '1', username: 'user1' }]);
  });
});
