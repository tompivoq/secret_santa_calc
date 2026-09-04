import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { createApp } from "../app.js";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";
import { people } from "../db/schema.js";
import { addPerson, setPartner, type CreatedPerson } from "../people/people.js";

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
	db = createDb(":memory:");
	migrate(db, { migrationsFolder });
	app = createApp(db, "test-secret");
});

const sessionCookieFrom = (res: Response): string => {
	const setCookie = res.headers.get("set-cookie");
	if (!setCookie) {
		throw new Error("Response did not set a cookie");
	}
	return setCookie.split(";")[0]!;
};

const seed = (name: string): CreatedPerson =>
	addPerson(db, { name, email: `${name.toLowerCase()}@example.com`, phone: 22334455 });

const makeAdmin = (personId: number) =>
	db.update(people).set({ isAdmin: true }).where(eq(people.id, personId)).run();

const loginAs = async (email: string, password: string) => {
	const res = await app.request("/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	return sessionCookieFrom(res);
};

const asAdmin = async () => {
	const admin = seed("Admin");
	makeAdmin(admin.id);
	return loginAs("admin@example.com", admin.initialPassword);
};

const postMatch = (personIds: number[], cookie?: string) =>
	app.request("/api/matcher", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
		body: JSON.stringify({ personIds }),
	});

describe("POST /api/matcher authorization", () => {
	it("returns 401 without a session", async () => {
		const anna = seed("Anna");
		expect((await postMatch([anna.id])).status).toBe(401);
	});

	it("returns 403 for a non-admin", async () => {
		const anna = seed("Anna");
		const cookie = await loginAs("anna@example.com", anna.initialPassword);
		expect((await postMatch([anna.id], cookie)).status).toBe(403);
	});
});

describe("POST /api/matcher", () => {
	it("fetches the given people and passes them to the matching logic", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");

		const res = await postMatch([anna.id, bjorn.id], cookie);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { id: number }[];
		expect(body.map((p) => p.id).sort()).toEqual([anna.id, bjorn.id].sort());
	});

	it("returns 400 if a given personId doesn't exist", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");

		const res = await postMatch([anna.id, 999_999], cookie);

		expect(res.status).toBe(400);
	});

	it("rejects an empty personIds array", async () => {
		const cookie = await asAdmin();
		const res = await postMatch([], cookie);
		expect(res.status).toBe(400);
	});

	it("returns 422 when no valid matching exists for the given group", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		setPartner(db, anna.id, bjorn.id);

		// The only two people given are each other's only possible recipient
		// and each other's partner — no valid assignment exists.
		const res = await postMatch([anna.id, bjorn.id], cookie);

		expect(res.status).toBe(422);
	});
});
