import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { credentials, people } from "../db/schema.js";
import { hashPassword } from "../auth/password.js";

export const DEV_ADMIN_EMAIL = "admin@dev.local";
export const DEV_ADMIN_PASSWORD = "devpassword";

/**
 * Dev convenience only: ensures a known admin account always exists, with
 * a fixed password, so there's something to log in as locally without
 * hunting down a real (randomly generated) initial password every time
 * the dev database is wiped. Never runs in production — gated by
 * NODE_ENV in index.ts, the same variable the systemd service sets for
 * the real deployment.
 *
 * Idempotent: does nothing if the account already exists, so restarting
 * the dev server doesn't recreate it (or hit the unique-email constraint)
 * on every run. Unlike a real person's credentials, mustChangePassword is
 * seeded false — the whole point is a password that's always the same.
 */
export const seedDevAdmin = (db: Db): void => {
	let admin = db.select().from(people).where(eq(people.email, DEV_ADMIN_EMAIL)).get();

	if (!admin) {
		admin = db.transaction((tx) => {
			const created = tx
				.insert(people)
				.values({ name: "Dev Admin", email: DEV_ADMIN_EMAIL, phone: 12345678, isAdmin: true })
				.returning()
				.get();
			tx.insert(credentials)
				.values({
					personId: created.id,
					passwordHash: hashPassword(DEV_ADMIN_PASSWORD),
					mustChangePassword: false,
				})
				.run();
			return created;
		});
	}

	console.log(`[dev] admin login: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);
};
