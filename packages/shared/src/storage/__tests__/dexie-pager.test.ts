import { describe, test, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { Dexie, type Table } from 'dexie';
import { Pager, SortOrder } from '../dexie/dataAccessObject/Pager';

/**
 * Interface representing a Friend
 */
interface Friend {
  id?: number; // Optional during bulkAdd as Dexie can auto-increment
  firstName: string;
  lastName: string;
  age: number;
}

/**
 * Extend Dexie to include the 'friends' table.
 */
class MyDatabase extends Dexie {
  friends!: Table<Friend, number>;

  constructor() {
    super('MyDatabase');
    this.version(1).stores({
      friends: '++id, lastName, age', // Primary key and indexes
    });
  }
}

describe('Pager', () => {
  let db: MyDatabase;

  beforeEach(async () => {
    // Initialize the database
    db = new MyDatabase();

    // Clear the table before each test to ensure test isolation
    await db.friends.clear();

    // Populate the database with sample data
    await db.friends.bulkAdd([
      { firstName: 'John', lastName: 'Doe', age: 25 },
      { firstName: 'Jane', lastName: 'Smith', age: 30 },
      { firstName: 'Alice', lastName: 'Johnson', age: 22 },
      { firstName: 'Bob', lastName: 'Brown', age: 28 },
      { firstName: 'Charlie', lastName: 'Davis', age: 35 },
      { firstName: 'Diana', lastName: 'Evans', age: 27 },
      { firstName: 'Ethan', lastName: 'Franklin', age: 24 },
      { firstName: 'Fiona', lastName: 'Garcia', age: 29 },
      { firstName: 'George', lastName: 'Harris', age: 23 },
      { firstName: 'Hannah', lastName: 'Irwin', age: 26 },
      // Add more friends as needed for extensive testing
    ]);
  });

  test('should paginate through friends correctly', async () => {
    // Define your filter criterion (e.g., friends older than 21)
    const criterionFunction = (friend: Friend) => friend.age > 21;

    // Create an instance of the pager with a page size of 5
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      criterionFunction,
      idProp: 'id',
      pageSize: 5,
    });

    // Expected order based on lastName: Brown, Davis, Evans, Franklin, Garcia, Harris, Irwin, Johnson, Smith, Doe

    // Function to fetch all pages and collect results
    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    // Fetch all pages
    const pages = await fetchAllPages();

    // Assertions
    expect(pages.length).toBe(2); // 10 items with pageSize 5

    // Page 1
    expect(pages[0].length).toBe(5);
    expect(pages[0][0].lastName).toBe('Brown');
    expect(pages[0][4].lastName).toBe('Franklin');

    // Page 2
    expect(pages[1].length).toBe(5);
    expect(pages[1][0].lastName).toBe('Garcia');
    expect(pages[1][4].lastName).toBe('Smith');

    // No more pages
    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });

  test('should reset and paginate from the beginning', async () => {
    // Define your filter criterion (e.g., friends older than 21)
    const criterionFunction = (friend: Friend) => friend.age > 21;

    // Create an instance of the pager with a page size of 3
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      criterionFunction,
      idProp: 'id',
      pageSize: 3,
    });

    // Fetch first page
    const firstPage = await pager.nextPage();
    expect(firstPage.length).toBe(3);
    expect(firstPage[0].lastName).toBe('Brown');
    expect(firstPage[2].lastName).toBe('Doe');

    // Fetch second page
    const secondPage = await pager.nextPage();
    expect(secondPage.length).toBe(3);
    expect(secondPage[0].lastName).toBe('Evans');
    expect(secondPage[2].lastName).toBe('Garcia');

    // Reset the pager
    pager.reset();

    // Fetch first page again after reset
    const resetFirstPage = await pager.nextPage();
    expect(resetFirstPage.length).toBe(3);
    expect(resetFirstPage[0].lastName).toBe('Brown');
    expect(resetFirstPage[2].lastName).toBe('Doe');
  });

  test('should handle cases where total items are not a multiple of pageSize', async () => {
    // Define your filter criterion (e.g., friends older than 25)
    const criterionFunction = (friend: Friend) => friend.age > 25;

    // Create an instance of the pager with a page size of 4
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      criterionFunction,
      idProp: 'id',
      pageSize: 4,
    });

    // Expected friends older than 25: Jane Smith, Bob Brown, Charlie Davis, Diana Evans, Fiona Garcia, Hannah Irwin

    // Function to fetch all pages and collect results
    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    // Fetch all pages
    const pages = await fetchAllPages();

    // Assertions
    expect(pages.length).toBe(2); // 6 items with pageSize 4

    // Page 1
    expect(pages[0].length).toBe(4);
    expect(pages[0][0].lastName).toBe('Brown');
    expect(pages[0][3].lastName).toBe('Garcia');

    // Page 2
    expect(pages[1].length).toBe(2);
    expect(pages[1][0].lastName).toBe('Irwin');
    expect(pages[1][1].lastName).toBe('Smith');

    // No more pages
    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });

  test('should return no pages if no items match the criterion', async () => {
    // Define a filter criterion that matches no friends (e.g., age > 100)
    const criterionFunction = (friend: Friend) => friend.age > 100;

    // Create an instance of the pager
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      criterionFunction,
      idProp: 'id',
      pageSize: 5,
    });

    // Fetch first page
    const page = await pager.nextPage();
    expect(page.length).toBe(0);

    // Ensure that subsequent pages are also empty
    const secondPage = await pager.nextPage();
    expect(secondPage.length).toBe(0);
  });

  test('should iterate over all items using async iterator', async () => {
    // Define your filter criterion (e.g., friends older than 21)
    const criterionFunction = (friend: Friend) => friend.age > 21;

    // Create an instance of the pager
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      criterionFunction,
      idProp: 'id',
    });

    // Collect all friends using the async iterator
    const friends: Friend[] = [];
    for await (const friend of pager) {
      friends.push(friend);
    }

    // Assertions
    expect(friends.length).toBe(10); // All friends are older than 21

    // Expected order based on lastName
    const expectedOrder = [
      'Brown',
      'Davis',
      'Doe',
      'Evans',
      'Franklin',
      'Garcia',
      'Harris',
      'Irwin',
      'Johnson',
      'Smith',
    ];

    friends.forEach((friend, index) => {
      expect(friend.lastName).toBe(expectedOrder[index]);
    });
  });

  test('should paginate through friends correctly in DESC order', async () => {
    const criterionFunction = (friend: Friend) => friend.age > 21;

    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      criterionFunction,
      idProp: 'id',
      pageSize: 5,
      sortOrder: SortOrder.DESC,
    });

    // Expected order: Smith, Johnson, Irwin, Harris, Garcia, Franklin, Evans, Doe, Davis, Brown

    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    const pages = await fetchAllPages();

    expect(pages.length).toBe(2);

    // Page 1
    expect(pages[0].length).toBe(5);
    expect(pages[0][0].lastName).toBe('Smith');
    expect(pages[0][4].lastName).toBe('Garcia');

    // Page 2
    expect(pages[1].length).toBe(5);
    expect(pages[1][0].lastName).toBe('Franklin');
    expect(pages[1][4].lastName).toBe('Brown');

    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });

  test('should reset and paginate from the beginning in DESC order', async () => {
    const criterionFunction = (friend: Friend) => friend.age > 21;

    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      criterionFunction,
      idProp: 'id',
      pageSize: 3,
      sortOrder: SortOrder.DESC,
    });

    const firstPage = await pager.nextPage();
    expect(firstPage.length).toBe(3);
    expect(firstPage[0].lastName).toBe('Smith');
    expect(firstPage[2].lastName).toBe('Irwin');

    const secondPage = await pager.nextPage();
    expect(secondPage.length).toBe(3);
    expect(secondPage[0].lastName).toBe('Harris');
    expect(secondPage[2].lastName).toBe('Franklin');

    pager.reset();

    const resetFirstPage = await pager.nextPage();
    expect(resetFirstPage.length).toBe(3);
    expect(resetFirstPage[0].lastName).toBe('Smith');
    expect(resetFirstPage[2].lastName).toBe('Irwin');
  });

  test('should handle cases where total items are not a multiple of pageSize in DESC order', async () => {
    const criterionFunction = (friend: Friend) => friend.age > 25;

    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      criterionFunction,
      idProp: 'id',
      pageSize: 4,
      sortOrder: SortOrder.DESC,
    });

    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    const pages = await fetchAllPages();

    expect(pages.length).toBe(2);

    // Page 1
    expect(pages[0].length).toBe(4);
    expect(pages[0][0].lastName).toBe('Smith');
    expect(pages[0][3].lastName).toBe('Evans');

    // Page 2
    expect(pages[1].length).toBe(2);
    expect(pages[1][0].lastName).toBe('Davis');
    expect(pages[1][1].lastName).toBe('Brown');

    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });

  test('should return no pages if no items match the criterion in DESC order', async () => {
    const criterionFunction = (friend: Friend) => friend.age > 100;

    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      criterionFunction,
      idProp: 'id',
      pageSize: 5,
      sortOrder: SortOrder.DESC,
    });

    const page = await pager.nextPage();
    expect(page.length).toBe(0);

    const secondPage = await pager.nextPage();
    expect(secondPage.length).toBe(0);
  });

  test('should iterate over all items using async iterator in DESC order', async () => {
    const criterionFunction = (friend: Friend) => friend.age > 21;

    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      criterionFunction,
      idProp: 'id',
      sortOrder: SortOrder.DESC,
    });

    // Collect all friends using the async iterator
    const friends: Friend[] = [];
    for await (const friend of pager) {
      friends.push(friend);
    }

    // Assertions
    expect(friends.length).toBe(10); // All friends are older than 21

    // Expected order based on lastName in DESC
    const expectedOrder = [
      'Smith',
      'Johnson',
      'Irwin',
      'Harris',
      'Garcia',
      'Franklin',
      'Evans',
      'Doe',
      'Davis',
      'Brown',
    ];

    friends.forEach((friend, index) => {
      expect(friend.lastName).toBe(expectedOrder[index]);
    });
  });

  test('should paginate correctly without providing idProp ', async () => {
    // No idProp provided, should default to 'id'
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      // idProp is omitted
      pageSize: 5,
      // No criterionFunction
    });

    // Function to fetch all pages and collect results
    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    // Fetch all pages
    const pages = await fetchAllPages();

    // Assertions
    expect(pages.length).toBe(2); // 10 items with pageSize 5

    // Page 1
    expect(pages[0].length).toBe(5);
    expect(pages[0][0].lastName).toBe('Brown');
    expect(pages[0][4].lastName).toBe('Franklin');

    // Page 2
    expect(pages[1].length).toBe(5);
    expect(pages[1][0].lastName).toBe('Garcia');
    expect(pages[1][4].lastName).toBe('Smith');

    // No more pages
    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });

  test('should paginate correctly without providing criterionFunction (defaults to always true)', async () => {
    // No criterionFunction provided, should include all items
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      idProp: 'id',
      pageSize: 5,
      // criterionFunction is omitted
    });

    // Function to fetch all pages and collect results
    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    // Fetch all pages
    const pages = await fetchAllPages();

    // Assertions
    expect(pages.length).toBe(2); // 10 items with pageSize 5

    // Page 1
    expect(pages[0].length).toBe(5);
    expect(pages[0][0].lastName).toBe('Brown');
    expect(pages[0][4].lastName).toBe('Franklin');

    // Page 2
    expect(pages[1].length).toBe(5);
    expect(pages[1][0].lastName).toBe('Garcia');
    expect(pages[1][4].lastName).toBe('Smith');

    // No more pages
    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });

  test('should paginate correctly without providing both idProp and criterionFunction', async () => {
    // Neither idProp nor criterionFunction provided
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      pageSize: 5,
      // Both idProp and criterionFunction are omitted
    });

    // Function to fetch all pages and collect results
    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    // Fetch all pages
    const pages = await fetchAllPages();

    // Assertions
    expect(pages.length).toBe(2); // 10 items with pageSize 5

    // Page 1
    expect(pages[0].length).toBe(5);
    expect(pages[0][0].lastName).toBe('Brown');
    expect(pages[0][4].lastName).toBe('Franklin');

    // Page 2
    expect(pages[1].length).toBe(5);
    expect(pages[1][0].lastName).toBe('Garcia');
    expect(pages[1][4].lastName).toBe('Smith');

    // No more pages
    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });

  test('should handle reset correctly without criterionFunction', async () => {
    // No criterionFunction provided
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      idProp: 'id',
      pageSize: 3,
      // criterionFunction is omitted
    });

    // Fetch first page
    const firstPage = await pager.nextPage();
    expect(firstPage.length).toBe(3);
    expect(firstPage[0].lastName).toBe('Brown');
    expect(firstPage[2].lastName).toBe('Doe');

    // Fetch second page
    const secondPage = await pager.nextPage();
    expect(secondPage.length).toBe(3);
    expect(secondPage[0].lastName).toBe('Evans');
    expect(secondPage[2].lastName).toBe('Garcia');

    // Reset the pager
    pager.reset();

    // Fetch first page again after reset
    const resetFirstPage = await pager.nextPage();
    expect(resetFirstPage.length).toBe(3);
    expect(resetFirstPage[0].lastName).toBe('Brown');
    expect(resetFirstPage[2].lastName).toBe('Doe');
  });

  test('should paginate correctly when idProp defaults to "id" and criterionFunction is omitted', async () => {
    // No idProp and no criterionFunction provided
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      pageSize: 4,
      // Both idProp and criterionFunction are omitted
    });

    // Function to fetch all pages and collect results
    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    // Fetch all pages
    const pages = await fetchAllPages();

    // Assertions
    expect(pages.length).toBe(3); // 10 items with pageSize 4 -> 3 pages

    // Page 1
    expect(pages[0].length).toBe(4);
    expect(pages[0][0].lastName).toBe('Brown');
    expect(pages[0][3].lastName).toBe('Evans');

    // Page 2
    expect(pages[1].length).toBe(4);
    expect(pages[1][0].lastName).toBe('Franklin');
    expect(pages[1][3].lastName).toBe('Irwin');

    // Page 3
    expect(pages[2].length).toBe(2);
    expect(pages[2][0].lastName).toBe('Johnson');
    expect(pages[2][1].lastName).toBe('Smith');

    // No more pages
    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });
});

describe('Pager with DESC sorting', () => {
  let db: MyDatabase;

  beforeEach(async () => {
    db = new MyDatabase();
    await db.friends.clear();
    await db.friends.bulkAdd([
      { firstName: 'John', lastName: 'Doe', age: 25 },
      { firstName: 'Jane', lastName: 'Smith', age: 30 },
      { firstName: 'Alice', lastName: 'Johnson', age: 22 },
      { firstName: 'Bob', lastName: 'Brown', age: 28 },
      { firstName: 'Charlie', lastName: 'Davis', age: 35 },
      { firstName: 'Diana', lastName: 'Evans', age: 27 },
      { firstName: 'Ethan', lastName: 'Franklin', age: 24 },
      { firstName: 'Fiona', lastName: 'Garcia', age: 29 },
      { firstName: 'George', lastName: 'Harris', age: 23 },
      { firstName: 'Hannah', lastName: 'Irwin', age: 26 },
    ]);
  });
  test('should paginate correctly without providing idProp (defaults to "id") in DESC order', async () => {
    // No idProp provided, should default to 'id'
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      pageSize: 5,
      sortOrder: SortOrder.DESC,
      // idProp is omitted
      // No criterionFunction
    });

    // Function to fetch all pages and collect results
    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    // Fetch all pages
    const pages = await fetchAllPages();

    // Assertions
    expect(pages.length).toBe(2); // 10 items with pageSize 5

    // Page 1
    expect(pages[0].length).toBe(5);
    expect(pages[0][0].lastName).toBe('Smith');
    expect(pages[0][4].lastName).toBe('Garcia');

    // Page 2
    expect(pages[1].length).toBe(5);
    expect(pages[1][0].lastName).toBe('Franklin');
    expect(pages[1][4].lastName).toBe('Brown');

    // No more pages
    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });

  test('should paginate correctly without providing criterionFunction (defaults to always true) in DESC order', async () => {
    // No criterionFunction provided, should include all items
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      idProp: 'id',
      pageSize: 5,
      sortOrder: SortOrder.DESC,
      // criterionFunction is omitted
    });

    // Function to fetch all pages and collect results
    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    // Fetch all pages
    const pages = await fetchAllPages();

    // Assertions
    expect(pages.length).toBe(2); // 10 items with pageSize 5

    // Page 1
    expect(pages[0].length).toBe(5);
    expect(pages[0][0].lastName).toBe('Smith');
    expect(pages[0][4].lastName).toBe('Garcia');

    // Page 2
    expect(pages[1].length).toBe(5);
    expect(pages[1][0].lastName).toBe('Franklin');
    expect(pages[1][4].lastName).toBe('Brown');

    // No more pages
    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });

  test('should paginate correctly without providing both idProp and criterionFunction in DESC order', async () => {
    // Neither idProp nor criterionFunction provided
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      pageSize: 5,
      sortOrder: SortOrder.DESC,
      // Both idProp and criterionFunction are omitted
    });

    // Function to fetch all pages and collect results
    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    // Fetch all pages
    const pages = await fetchAllPages();

    // Assertions
    expect(pages.length).toBe(2); // 10 items with pageSize 5

    // Page 1
    expect(pages[0].length).toBe(5);
    expect(pages[0][0].lastName).toBe('Smith');
    expect(pages[0][4].lastName).toBe('Garcia');

    // Page 2
    expect(pages[1].length).toBe(5);
    expect(pages[1][0].lastName).toBe('Franklin');
    expect(pages[1][4].lastName).toBe('Brown');

    // No more pages
    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });

  test('should handle reset correctly without criterionFunction in DESC order', async () => {
    // No criterionFunction provided
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      idProp: 'id',
      pageSize: 3,
      sortOrder: SortOrder.DESC,
      // criterionFunction is omitted
    });

    // Fetch first page
    const firstPage = await pager.nextPage();
    expect(firstPage.length).toBe(3);
    expect(firstPage[0].lastName).toBe('Smith');
    expect(firstPage[2].lastName).toBe('Irwin');

    // Fetch second page
    const secondPage = await pager.nextPage();
    expect(secondPage.length).toBe(3);
    expect(secondPage[0].lastName).toBe('Harris');
    expect(secondPage[2].lastName).toBe('Franklin');

    // Reset the pager
    pager.reset();

    // Fetch first page again after reset
    const resetFirstPage = await pager.nextPage();
    expect(resetFirstPage.length).toBe(3);
    expect(resetFirstPage[0].lastName).toBe('Smith');
    expect(resetFirstPage[2].lastName).toBe('Irwin');
  });

  test('should paginate correctly when idProp defaults to "id" and criterionFunction is omitted in DESC order', async () => {
    // No idProp and no criterionFunction provided
    const pager = new Pager<Friend>({
      table: db.friends,
      index: 'lastName',
      pageSize: 4,
      sortOrder: SortOrder.DESC,
      // Both idProp and criterionFunction are omitted
    });

    // Function to fetch all pages and collect results
    const fetchAllPages = async (): Promise<Friend[][]> => {
      const pages: Friend[][] = [];
      while (!pager.done) {
        const page = await pager.nextPage();
        if (page.length === 0) break;
        pages.push(page);
      }
      return pages;
    };

    // Fetch all pages
    const pages = await fetchAllPages();

    // Assertions
    expect(pages.length).toBe(3); // 10 items with pageSize 4 -> 3 pages

    // Page 1
    expect(pages[0].length).toBe(4);
    expect(pages[0][0].lastName).toBe('Smith');
    expect(pages[0][3].lastName).toBe('Harris');

    // Page 2
    expect(pages[1].length).toBe(4);
    expect(pages[1][0].lastName).toBe('Garcia');
    expect(pages[1][3].lastName).toBe('Doe');

    // Page 3
    expect(pages[2].length).toBe(2);
    expect(pages[2][0].lastName).toBe('Davis');
    expect(pages[2][1].lastName).toBe('Brown');

    // No more pages
    const emptyPage = await pager.nextPage();
    expect(emptyPage.length).toBe(0);
  });
});
