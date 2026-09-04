import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The key used to sign session JWTs. Read from the `AUTH_SECRET` env var if
 * set; otherwise a random one is generated on first run and persisted as a
 * file next to the database, so it survives restarts without needing a
 * secret to be provisioned by hand (or root access to edit the service
 * file) on every deployment.
 */
export const getOrCreateAuthSecret = (dbPath: string): string => {
	if (process.env.AUTH_SECRET) {
		return process.env.AUTH_SECRET;
	}

	const secretPath = join(dirname(dbPath), "auth_secret");
	if (existsSync(secretPath)) {
		return readFileSync(secretPath, "utf-8").trim();
	}

	const secret = randomBytes(32).toString("hex");
	mkdirSync(dirname(secretPath), { recursive: true });
	writeFileSync(secretPath, secret, { mode: 0o600 });
	return secret;
};
