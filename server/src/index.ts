import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { getOrCreateAuthSecret } from "./auth/secret.js";
import { seedDevAdmin } from "./dev/seedAdmin.js";
import { createMailerFromEnv } from "./mail/mailer.js";

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

// Where the app is reached from outside — what emailed links point at.
// Not derived from the request: a link has to keep working long after the
// request that created it, and whatever proxy forwarded that one.
const appBaseUrl = process.env.APP_BASE_URL ?? `http://localhost:${port}`;

const app = createApp(db, authSecret, {
	appBaseUrl,
	// Reads RESEND_API_KEY / MAIL_FROM, and logs instead of sending if
	// either is missing. Both are secrets/config for the deployed service to
	// provide — never committed. See DEPLOYMENT.md.
	mailer: createMailerFromEnv(),
});

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`secret_santa_calc API listening on http://localhost:${info.port} (db: ${dbPath})`);
});
