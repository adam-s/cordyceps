/* eslint-disable @typescript-eslint/no-explicit-any */
import { Dexie } from 'dexie';
import { DatabasePlugin } from './dataAccessObject/DatabasePlugin';

// Union→Intersection helper
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

// Build table map from each plugin’s own <T,K>
type TableMap<Plugins extends readonly DatabasePlugin<any, any>[]> = UnionToIntersection<
  {
    [I in keyof Plugins]: Plugins[I] extends DatabasePlugin<infer T, infer K>
      ? { [Table in Plugins[I]['tableName']]: Dexie.Table<T, K> }
      : never;
  }[number]
>;

/**
 * Now accepts DatabasePlugin<IUserModel,string> without error,
 * and still infers db.users as Dexie.Table<IUserModel,string>.
 */
export function createAppDatabase<const Plugins extends readonly DatabasePlugin<any, any>[]>(
  plugins: readonly [...Plugins],
): Dexie & TableMap<Plugins> {
  const db = new Dexie('AppDatabase');

  // 1) Collect versions & per-table schemas
  const allVersions = new Set<number>();
  const schemaPerTable: Record<string, { version: number; schema: string }[]> = {};

  for (const p of plugins) {
    schemaPerTable[p.tableName] ??= [];
    for (const verStr in p.schema) {
      const version = Number(verStr);
      allVersions.add(version);
      schemaPerTable[p.tableName].push({ version, schema: p.schema[verStr] });
    }
    schemaPerTable[p.tableName].sort((a, b) => a.version - b.version);
  }

  // 2) Apply each version’s .stores(...)
  for (const version of Array.from(allVersions).sort((a, b) => a - b)) {
    const stores: Record<string, string> = {};
    for (const [tableName, versions] of Object.entries(schemaPerTable)) {
      let latest: string | undefined;
      for (const entry of versions) {
        if (entry.version <= version) latest = entry.schema;
        else break;
      }
      if (latest) stores[tableName] = latest;
    }
    db.version(version).stores(stores);
  }

  // 3) Attach each typed table
  for (const p of plugins) {
    Object.defineProperty(db, p.tableName, {
      value: db.table(p.tableName),
      writable: false,
      enumerable: true,
      configurable: true,
    });
  }

  return db as Dexie & TableMap<Plugins>;
}
