import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "./client.js";

export const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

/** Applies any pending migrations. Safe to run on every server startup — a no-op once caught up. */
export const runMigrations = (dbPath: string): void => {
	const db = createDb(dbPath);
	migrate(db, { migrationsFolder });
};
