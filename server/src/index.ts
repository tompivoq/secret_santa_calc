import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { getOrCreateAuthSecret } from "./auth/secret.js";

const port = Number(process.env.PORT ?? 3001);
const dbPath = process.env.DATABASE_PATH ?? "./data/db.sqlite";

runMigrations(dbPath);

const db = createDb(dbPath);
const authSecret = getOrCreateAuthSecret(dbPath);
const app = createApp(db, authSecret);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`secret_santa_calc API listening on http://localhost:${info.port} (db: ${dbPath})`);
});
