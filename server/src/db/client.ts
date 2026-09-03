import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** The transaction-scoped db handle passed into `db.transaction(tx => ...)` callbacks. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Creates a Drizzle DB instance backed by better-sqlite3.
 *
 * - `path` defaults to an in-memory database (fresh, isolated — used by tests).
 * - Pass a file path for a persistent database (used by the running server).
 */
export const createDb = (path = ":memory:"): Db => {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  // Off by default in SQLite. Needed for the credentials table's cascade
  // delete (removing a person removes their login credentials too) to
  // actually take effect rather than silently no-op.
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
};
