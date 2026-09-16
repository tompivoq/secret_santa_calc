/**
 * Writes a consistent snapshot of the database to a file, and verifies it
 * isn't empty before reporting success.
 *
 * Use this rather than copying db.sqlite. The database runs in WAL mode
 * (see db/client.ts) and the running server holds a long-lived connection,
 * so committed data can sit in db.sqlite-wal for a long time without ever
 * being folded into the main file — which on this deployment left
 * db.sqlite at 4096 bytes with no tables in it at all. `cp db.sqlite`
 * therefore produces a backup of nothing, convincingly, at a plausible
 * path. VACUUM INTO folds the WAL in and writes a complete copy, and is
 * safe to run while the server is serving.
 *
 * Usage:
 *   npx tsx src/scripts/backup-db.ts [destination]
 *   node dist/scripts/backup-db.js [destination]      # on the server
 *
 * Reads DATABASE_PATH the same way the server does. Destination defaults
 * to ./backups/db-<timestamp>.sqlite.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH ?? "./data/db.sqlite";
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const destination = process.argv[2] ?? `./backups/db-${stamp}.sqlite`;

mkdirSync(dirname(destination), { recursive: true });

const source = new Database(dbPath, { readonly: true });
source.prepare("vacuum into ?").run(destination);
source.close();

// Never report a backup on the strength of a file having appeared — that's
// exactly the failure this script exists to prevent.
const check = new Database(destination, { readonly: true });
const tables = check
	.prepare("select count(*) as count from sqlite_master where type = 'table'")
	.get() as { count: number };
const people = check.prepare("select count(*) as count from people").get() as { count: number };
check.close();

if (tables.count === 0) {
	console.error(`Backup at ${destination} contains no tables — refusing to call that a backup.`);
	process.exit(1);
}

console.log(`Backed up ${dbPath} -> ${destination}`);
console.log(`  ${tables.count} tables, ${people.count} people`);
