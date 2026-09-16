import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { createApp } from "./app.js";
import { createDb, type Db } from "./db/client.js";
import { migrationsFolder } from "./db/migrate.js";
import { people } from "./db/schema.js";
import { addPerson, listPeople, type CreatedPerson } from "./people/people.js";
import { login } from "./auth/service.js";

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
	db = createDb(":memory:");
	migrate(db, { migrationsFolder });
	app = createApp(db, "test-secret");
});

/** Extracts the `session=...` cookie pair (dropping attributes like Path/HttpOnly) from a Set-Cookie header. */
const sessionCookieFrom = (res: Response): string => {
	const setCookie = res.headers.get("set-cookie");
	if (!setCookie) {
		throw new Error("Response did not set a cookie");
	}
	return setCookie.split(";")[0]!;
};

const seed = (name: string): CreatedPerson =>
	addPerson(db, { name, email: `${name.toLowerCase()}@example.com`, phone: 22334455 });

/** Grants the admin role directly in the DB — there's no API for it, by design (see set-admin.ts). */
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

interface LoginResponseBody {
	person: { id: number };
	mustChangePassword: boolean;
}

interface MeResponseBody {
	person: { id: number };
}

const asLoginBody = async (res: Response) => (await res.json()) as LoginResponseBody;
const asMeBody = async (res: Response) => (await res.json()) as MeResponseBody;

describe("POST /api/auth/login", () => {
	it("sets a session cookie and reports mustChangePassword on success", async () => {
		const anna = seed("Anna");

		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "anna@example.com", password: anna.initialPassword }),
		});

		expect(res.status).toBe(200);
		expect(sessionCookieFrom(res)).toMatch(/^session=/);
		const body = await asLoginBody(res);
		expect(body.mustChangePassword).toBe(true);
		expect(body.person.id).toBe(anna.id);
	});

	it("returns 401 for the wrong password, and sets no cookie", async () => {
		seed("Anna");

		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "anna@example.com", password: "wrong" }),
		});

		expect(res.status).toBe(401);
		expect(res.headers.get("set-cookie")).toBeNull();
	});
});

describe("GET /api/auth/me", () => {
	it("returns 401 without a session cookie", async () => {
		const res = await app.request("/api/auth/me");
		expect(res.status).toBe(401);
	});

	it("returns the logged-in person given a valid session cookie", async () => {
		const anna = seed("Anna");
		const loginRes = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "anna@example.com", password: anna.initialPassword }),
		});
		const cookie = sessionCookieFrom(loginRes);

		const res = await app.request("/api/auth/me", { headers: { cookie } });

		expect(res.status).toBe(200);
		const body = await asMeBody(res);
		expect(body.person.id).toBe(anna.id);
	});
});

describe("POST /api/auth/change-password", () => {
	it("changes the password and clears mustChangePassword", async () => {
		const anna = seed("Anna");
		const cookie = await loginAs("anna@example.com", anna.initialPassword);

		const res = await app.request("/api/auth/change-password", {
			method: "POST",
			headers: { "Content-Type": "application/json", cookie },
			body: JSON.stringify({
				currentPassword: anna.initialPassword,
				newPassword: "a-new-password",
			}),
		});
		expect(res.status).toBe(204);

		const meRes = await app.request("/api/auth/me", { headers: { cookie } });
		expect(meRes.status).toBe(200);

		const secondLogin = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "anna@example.com", password: "a-new-password" }),
		});
		expect((await asLoginBody(secondLogin)).mustChangePassword).toBe(false);
	});

	it("returns 401 without a session, and 401 for the wrong current password", async () => {
		const anna = seed("Anna");

		const unauthed = await app.request("/api/auth/change-password", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ currentPassword: "x", newPassword: "a-new-password" }),
		});
		expect(unauthed.status).toBe(401);

		const cookie = await loginAs("anna@example.com", anna.initialPassword);
		const wrongCurrent = await app.request("/api/auth/change-password", {
			method: "POST",
			headers: { "Content-Type": "application/json", cookie },
			body: JSON.stringify({ currentPassword: "wrong", newPassword: "a-new-password" }),
		});
		expect(wrongCurrent.status).toBe(401);
	});
});

describe("/api/people authorization", () => {
	it("returns 401 for every route without a session", async () => {
		seed("Anna");

		expect((await app.request("/api/people")).status).toBe(401);
		expect(
			(
				await app.request("/api/people", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: "Someone", email: "someone@example.com", phone: 1 }),
				})
			).status,
		).toBe(401);
		expect((await app.request("/api/people/1", { method: "DELETE" })).status).toBe(401);
		expect(
			(
				await app.request("/api/people/1", {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: "Renamed" }),
				})
			).status,
		).toBe(401);
	});

	it("returns 403 for every route when logged in as a non-admin", async () => {
		const anna = seed("Anna");
		const cookie = await loginAs("anna@example.com", anna.initialPassword);

		expect((await app.request("/api/people", { headers: { cookie } })).status).toBe(403);
		expect(
			(
				await app.request("/api/people", {
					method: "POST",
					headers: { "Content-Type": "application/json", cookie },
					body: JSON.stringify({ name: "Someone", email: "someone@example.com", phone: 1 }),
				})
			).status,
		).toBe(403);
		expect(
			(await app.request(`/api/people/${anna.id}`, { method: "DELETE", headers: { cookie } }))
				.status,
		).toBe(403);
		expect(
			(
				await app.request(`/api/people/${anna.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json", cookie },
					// Not even themselves: editing through the people API is an
					// admin action. Their own details go through /api/auth/me.
					body: JSON.stringify({ name: "Renamed" }),
				})
			).status,
		).toBe(403);

		// None of the above actually went through.
		expect(await (await app.request("/api/auth/me", { headers: { cookie } })).json()).toMatchObject(
			{
				person: { id: anna.id },
			},
		);
	});

	it("allows every route when logged in as an admin", async () => {
		const admin = seed("Admin");
		makeAdmin(admin.id);
		const cookie = await loginAs("admin@example.com", admin.initialPassword);

		expect((await app.request("/api/people", { headers: { cookie } })).status).toBe(200);

		const createRes = await app.request("/api/people", {
			method: "POST",
			headers: { "Content-Type": "application/json", cookie },
			body: JSON.stringify({ name: "Someone", email: "someone@example.com", phone: 22334455 }),
		});
		expect(createRes.status).toBe(201);
		const created = (await createRes.json()) as { id: number };

		expect(
			(
				await app.request(`/api/people/${created.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json", cookie },
					body: JSON.stringify({ partnerId: admin.id, lastYearRecipientId: admin.id }),
				})
			).status,
		).toBe(200);

		expect(
			(
				await app.request(`/api/people/${created.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json", cookie },
					body: JSON.stringify({ name: "Someone Else" }),
				})
			).status,
		).toBe(200);

		expect(
			(await app.request(`/api/people/${created.id}`, { method: "DELETE", headers: { cookie } }))
				.status,
		).toBe(204);
	});
});

describe("POST /api/people", () => {
	it("rejects a duplicate email with 409", async () => {
		const admin = seed("Admin");
		makeAdmin(admin.id);
		const cookie = await loginAs("admin@example.com", admin.initialPassword);
		seed("Anna");

		const res = await app.request("/api/people", {
			method: "POST",
			headers: { "Content-Type": "application/json", cookie },
			body: JSON.stringify({ name: "Anna Again", email: "anna@example.com", phone: 22334455 }),
		});

		expect(res.status).toBe(409);
	});
});

describe("CORS", () => {
	it("grants no cross-origin access — no Access-Control-* headers on any response", async () => {
		// A third-party page sending its own Origin header and asking (via a
		// preflight) whether it may make a credentialed request.
		const preflight = await app.request("/api/people", {
			method: "OPTIONS",
			headers: {
				origin: "https://evil.example",
				"access-control-request-method": "GET",
			},
		});
		expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
		expect(preflight.headers.get("access-control-allow-credentials")).toBeNull();

		// And an actual cross-origin request — Access-Control-Allow-Origin
		// being reflected (or set at all) is what would let the browser hand
		// the response body back to that page's JS instead of blocking it.
		const res = await app.request("/api/people", { headers: { origin: "https://evil.example" } });
		expect(res.headers.get("access-control-allow-origin")).toBeNull();
		expect(res.headers.get("access-control-allow-credentials")).toBeNull();
	});
});

describe("PATCH /api/people/:id", () => {
	const asAdmin = async () => {
		const admin = seed("Admin");
		makeAdmin(admin.id);
		return loginAs("admin@example.com", admin.initialPassword);
	};

	const patch = (id: number, cookie: string, body: Record<string, unknown>) =>
		app.request(`/api/people/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json", cookie },
			body: JSON.stringify(body),
		});

	it("returns the person as they now are", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");

		const res = await patch(anna.id, cookie, { name: "Anna Marie", phone: 99887766 });

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			id: anna.id,
			name: "Anna Marie",
			phone: 99887766,
			email: "anna@example.com",
		});
	});

	it("rejects an email that belongs to someone else with 409", async () => {
		const cookie = await asAdmin();
		seed("Carl");
		const anna = seed("Anna");

		const res = await patch(anna.id, cookie, { email: "carl@example.com" });

		expect(res.status).toBe(409);
	});

	it("404s for a person who doesn't exist", async () => {
		const cookie = await asAdmin();
		expect((await patch(999_999, cookie, { name: "Nobody" })).status).toBe(404);
	});

	it("400s on a partner who doesn't exist", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		expect((await patch(anna.id, cookie, { partnerId: 999_999 })).status).toBe(400);
	});

	it("rejects an invalid phone number", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		expect((await patch(anna.id, cookie, { phone: 1 })).status).toBe(400);
	});
});

describe("PATCH /api/auth/me", () => {
	const patchMe = (cookie: string, body: Record<string, unknown>) =>
		app.request("/api/auth/me", {
			method: "PATCH",
			headers: { "Content-Type": "application/json", cookie },
			body: JSON.stringify(body),
		});

	it("lets a non-admin change their own details", async () => {
		const anna = seed("Anna");
		const cookie = await loginAs("anna@example.com", anna.initialPassword);

		const res = await patchMe(cookie, { name: "Anna Marie", phone: 99887766 });

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ id: anna.id, name: "Anna Marie", phone: 99887766 });
	});

	it("requires a session", async () => {
		const res = await app.request("/api/auth/me", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Nobody" }),
		});
		expect(res.status).toBe(401);
	});

	it("won't let someone set their own partner or last year's match", async () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const cookie = await loginAs("anna@example.com", anna.initialPassword);

		// Those are inputs to the draw, not personal details — the schema
		// ignores them rather than quietly letting someone rig their own.
		await patchMe(cookie, { partnerId: bjorn.id, lastYearRecipientId: bjorn.id });

		const updated = listPeople(db).find((p) => p.id === anna.id)!;
		expect(updated.partnerId).toBeNull();
		expect(updated.lastYearRecipientId).toBeNull();
	});

	it("can't take an email that belongs to someone else", async () => {
		seed("Carl");
		const anna = seed("Anna");
		const cookie = await loginAs("anna@example.com", anna.initialPassword);

		expect((await patchMe(cookie, { email: "carl@example.com" })).status).toBe(409);
	});

	it("changes the email login actually uses", async () => {
		const anna = seed("Anna");
		const cookie = await loginAs("anna@example.com", anna.initialPassword);

		await patchMe(cookie, { email: "anna.marie@example.com" });

		// Email is the login identifier, so moving it moves how they sign in.
		expect(login(db, "anna.marie@example.com", anna.initialPassword)).not.toBeNull();
		expect(login(db, "anna@example.com", anna.initialPassword)).toBeNull();
	});
});
