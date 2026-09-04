import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { getOrCreateAuthSecret } from "./auth/secret.js";
import { seedDevAdmin } from "./dev/seedAdmin.js";

const port = Number(process.env.PORT ?? 3001);
const dbPath = process.env.DATABASE_PATH ?? "./data/db.sqlite";

runMigrations(dbPath);

const db = createDb(dbPath);
const authSecret = getOrCreateAuthSecret(dbPath);

// The deployed service sets NODE_ENV=production (see the systemd unit) —
// this is the one thing standing between a known, fixed admin password
// and it ever existing anywhere but a local dev database.
if (process.env.NODE_ENV !== "production") {
	seedDevAdmin(db);
}

const app = createApp(db, authSecret);

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`secret_santa_calc API listening on http://localhost:${info.port} (db: ${dbPath})`);
});
