import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { sign } from "hono/jwt";
import { createApp } from "../app.js";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";
import { credentials } from "../db/schema.js";
import { addPerson, type CreatedPerson } from "../people/people.js";
import { consumeMagicToken, issueMagicToken } from "./magic.js";
import { changePassword, login } from "./service.js";

const SECRET = "test-secret";

let db: Db;

beforeEach(() => {
	db = createDb(":memory:");
	migrate(db, { migrationsFolder });
});

const seed = (name: string): CreatedPerson =>
	addPerson(db, { name, email: `${name.toLowerCase()}@example.com`, phone: 22334455 });

const credsFor = (personId: number) =>
	db.select().from(credentials).where(eq(credentials.personId, personId)).get()!;

describe("magic-link tokens", () => {
	it("logs in the person it was issued for", async () => {
		const anna = seed("Anna");
		const token = (await issueMagicToken(db, anna.id, SECRET))!;

		expect(await consumeMagicToken(db, token, SECRET)).toBe(anna.id);
	});

	it("can only be used once", async () => {
		const anna = seed("Anna");
		const token = (await issueMagicToken(db, anna.id, SECRET))!;

		expect(await consumeMagicToken(db, token, SECRET)).toBe(anna.id);
		// The signature and expiry are still perfectly valid — it's the stored
		// id being cleared that stops it working a second time.
		expect(await consumeMagicToken(db, token, SECRET)).toBeNull();
	});

	it("invalidates an earlier link when a new one is issued", async () => {
		const anna = seed("Anna");
		const first = (await issueMagicToken(db, anna.id, SECRET))!;
		const second = (await issueMagicToken(db, anna.id, SECRET))!;

		expect(await consumeMagicToken(db, first, SECRET)).toBeNull();
		expect(await consumeMagicToken(db, second, SECRET)).toBe(anna.id);
	});

	it("rejects a token signed with a different secret", async () => {
		const anna = seed("Anna");
		const token = (await issueMagicToken(db, anna.id, "some-other-secret"))!;

		expect(await consumeMagicToken(db, token, SECRET)).toBeNull();
	});

	it("rejects an expired token", async () => {
		const anna = seed("Anna");
		// Issue one properly first, so the id in the token below is genuinely
		// the stored one and expiry is the only thing wrong with it.
		await issueMagicToken(db, anna.id, SECRET);
		const token = await sign(
			{
				personId: anna.id,
				jti: credsFor(anna.id).magicTokenId,
				purpose: "magic",
				exp: Math.floor(Date.now() / 1000) - 60,
			},
			SECRET,
			"HS256",
		);

		expect(await consumeMagicToken(db, token, SECRET)).toBeNull();
	});

	it("rejects a session cookie presented as a login link", async () => {
		const anna = seed("Anna");
		await issueMagicToken(db, anna.id, SECRET);
		// Same secret, same personId — only the purpose differs, which is the
		// entire reason the claim exists.
		const sessionToken = await sign(
			{ personId: anna.id, purpose: "session", exp: Math.floor(Date.now() / 1000) + 600 },
			SECRET,
			"HS256",
		);

		expect(await consumeMagicToken(db, sessionToken, SECRET)).toBeNull();
	});

	it("returns nothing for a person who doesn't exist", async () => {
		expect(await issueMagicToken(db, 999_999, SECRET)).toBeNull();
	});
});

describe("what following a magic link does to the password", () => {
	it("retires an initial password the person never replaced", async () => {
		const anna = seed("Anna");
		const token = (await issueMagicToken(db, anna.id, SECRET))!;

		await consumeMagicToken(db, token, SECRET);

		// The admin who set Anna up knows this password; once she's proved she
		// controls the email address, it stops being a way in.
		expect(login(db, "anna@example.com", anna.initialPassword)).toBeNull();
		// ...and she isn't stranded on a change-password form asking for it.
		expect(credsFor(anna.id).mustChangePassword).toBe(false);
	});

	it("leaves a password the person chose themselves alone", async () => {
		const anna = seed("Anna");
		changePassword(db, anna.id, anna.initialPassword, "a-password-anna-picked");
		const token = (await issueMagicToken(db, anna.id, SECRET))!;

		await consumeMagicToken(db, token, SECRET);

		// Only ever retires a password they never picked — following a link
		// must not lock someone out of one they're actually using.
		expect(login(db, "anna@example.com", "a-password-anna-picked")).not.toBeNull();
	});
});

describe("GET /api/auth/magic/:token", () => {
	it("sets a session and redirects into the app", async () => {
		const app = createApp(db, SECRET);
		const anna = seed("Anna");
		const token = (await issueMagicToken(db, anna.id, SECRET))!;

		const res = await app.request(`/api/auth/magic/${token}`);

		expect(res.status).toBe(303);
		expect(res.headers.get("location")).toBe("/account");
		const cookie = res.headers.get("set-cookie")!.split(";")[0]!;

		// The session it hands out is a real one.
		const me = await app.request("/api/auth/me", { headers: { cookie } });
		expect(me.status).toBe(200);
		expect(await me.json()).toMatchObject({ person: { id: anna.id } });
	});

	it("sends a spent link back to the login page rather than erroring", async () => {
		const app = createApp(db, SECRET);
		const anna = seed("Anna");
		const token = (await issueMagicToken(db, anna.id, SECRET))!;
		await app.request(`/api/auth/magic/${token}`);

		const res = await app.request(`/api/auth/magic/${token}`);

		expect(res.status).toBe(303);
		expect(res.headers.get("location")).toBe("/login?error=link-expired");
		expect(res.headers.get("set-cookie")).toBeNull();
	});

	it("won't accept a magic token as a session cookie", async () => {
		const app = createApp(db, SECRET);
		const anna = seed("Anna");
		const token = (await issueMagicToken(db, anna.id, SECRET))!;

		// Skipping the redirect and using the link's token directly as the
		// cookie would otherwise log in without ever spending the link.
		const res = await app.request("/api/auth/me", { headers: { cookie: `session=${token}` } });

		expect(res.status).toBe(401);
		// And the link is still unspent, so it hasn't been quietly burned either.
		expect(await consumeMagicToken(db, token, SECRET)).toBe(anna.id);
	});
});
