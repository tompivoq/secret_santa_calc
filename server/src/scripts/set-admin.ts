/**
 * One-off CLI to grant or revoke the admin role for a person, by email.
 * Deliberately not exposed through the API — there's no way to
 * self-escalate to admin through the app; doing this requires direct
 * access to the server (and its database).
 *
 * Usage:
 *   npx tsx src/scripts/set-admin.ts <email>          # grant admin
 *   npx tsx src/scripts/set-admin.ts <email> false     # revoke admin
 *
 * Reads DATABASE_PATH the same way the server does (defaults to
 * ./data/db.sqlite, relative to wherever this is run from).
 */
import { eq } from "drizzle-orm";
import { createDb } from "../db/client.js";
import { people } from "../db/schema.js";

const [, , email, flag] = process.argv;

if (!email) {
	console.error("Usage: set-admin.ts <email> [false]");
	process.exit(1);
}

const isAdmin = flag !== "false";
const dbPath = process.env.DATABASE_PATH ?? "./data/db.sqlite";
const db = createDb(dbPath);

const result = db.update(people).set({ isAdmin }).where(eq(people.email, email)).run();

if (result.changes === 0) {
	console.error(`No person found with email ${email}`);
	process.exit(1);
}

console.log(`${email} is now ${isAdmin ? "an admin" : "not an admin"}.`);
