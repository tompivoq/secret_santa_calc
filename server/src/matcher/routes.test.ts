import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { createApp } from "../app.js";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";
import { people } from "../db/schema.js";
import { addPerson, setPartner, type CreatedPerson } from "../people/people.js";
import { asPairs, getLatestLockedDraw, hasDraft, lockDraft, saveDraft } from "./draws.js";

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

interface DraftOptions {
	startOver?: boolean;
	/** Left visible by default here — most of these tests assert on the pairings. */
	blind?: boolean;
}

const postDraft = (personIds: number[], cookie?: string, options: DraftOptions = {}) =>
	app.request("/api/matcher/draft", {
		method: "POST",
		headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
		body: JSON.stringify({ personIds, blind: false, ...options }),
	});

const postLock = (cookie?: string) =>
	app.request("/api/matcher/lock", {
		method: "POST",
		headers: { ...(cookie && { cookie }) },
	});

const getCurrent = (cookie?: string) =>
	app.request("/api/matcher/current", { headers: { ...(cookie && { cookie }) } });

interface DraftBody {
	draw: {
		id: number;
		lockedAt: string | null;
		assignments: { giverId: number; recipientId: number }[];
	};
	repeatedLastYear: boolean;
}

describe("matcher routes: authorization", () => {
	it("returns 401 without a session", async () => {
		const anna = seed("Anna");
		expect((await postDraft([anna.id])).status).toBe(401);
		expect((await postLock()).status).toBe(401);
		expect((await getCurrent()).status).toBe(401);
	});

	it("returns 403 for a non-admin", async () => {
		const anna = seed("Anna");
		const cookie = await loginAs("anna@example.com", anna.initialPassword);
		expect((await postDraft([anna.id], cookie)).status).toBe(403);
		expect((await postLock(cookie)).status).toBe(403);
		expect((await getCurrent(cookie)).status).toBe(403);
	});
});

describe("POST /api/matcher/draft", () => {
	it("matches the given people and saves the result as a draft", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");

		const res = await postDraft([anna.id, bjorn.id], cookie);

		expect(res.status).toBe(200);
		const body = (await res.json()) as DraftBody;
		expect(body.draw.lockedAt).toBeNull();
		expect(body.draw.assignments.map((a) => a.giverId).sort()).toEqual([anna.id, bjorn.id].sort());
		expect(hasDraft(db)).toBe(true);
		// A draft is not the official result — nothing is locked yet.
		expect(getLatestLockedDraw(db)).toBeNull();
	});

	it("replaces the previous draft when re-rolled", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");

		const first = (await (await postDraft([anna.id, bjorn.id], cookie)).json()) as DraftBody;
		const second = (await (await postDraft([anna.id, bjorn.id], cookie)).json()) as DraftBody;

		expect(second.draw.id).not.toBe(first.draw.id);
		const current = (await (await getCurrent(cookie)).json()) as DraftBody["draw"];
		expect(current.id).toBe(second.draw.id);
	});

	it("returns 400 if a given personId doesn't exist", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");

		expect((await postDraft([anna.id, 999_999], cookie)).status).toBe(400);
	});

	it("rejects an empty personIds array", async () => {
		const cookie = await asAdmin();
		expect((await postDraft([], cookie)).status).toBe(400);
	});

	it("returns 422 when no valid matching exists for the given group", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		setPartner(db, anna.id, bjorn.id);

		expect((await postDraft([anna.id, bjorn.id], cookie)).status).toBe(422);
	});
});

describe("POST /api/matcher/lock", () => {
	it("locks the draft in, freezing exactly what was drafted", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const drafted = (await (await postDraft([anna.id, bjorn.id], cookie)).json()) as DraftBody;

		const res = await postLock(cookie);

		expect(res.status).toBe(200);
		const locked = (await res.json()) as DraftBody["draw"];
		expect(locked.id).toBe(drafted.draw.id);
		expect(locked.lockedAt).not.toBeNull();
		expect(locked.assignments).toEqual(drafted.draw.assignments);
	});

	it("returns 409 when there's no draft to lock", async () => {
		const cookie = await asAdmin();
		expect((await postLock(cookie)).status).toBe(409);
	});

	it("returns 409 rather than re-locking an already-locked draw", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		await postDraft([anna.id, bjorn.id], cookie);
		await postLock(cookie);

		expect((await postLock(cookie)).status).toBe(409);
	});
});

describe("drafting again once the draw is locked in", () => {
	it("refuses without startOver, so an accidental click can't re-draw", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		await postDraft([anna.id, bjorn.id], cookie);
		const locked = (await (await postLock(cookie)).json()) as DraftBody["draw"];

		const res = await postDraft([anna.id, bjorn.id], cookie);

		expect(res.status).toBe(409);
		// ...and the locked draw is untouched.
		expect(getLatestLockedDraw(db)!.id).toBe(locked.id);
	});

	it("starts a new draft alongside the locked draw when startOver is given", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		await postDraft([anna.id, bjorn.id], cookie);
		const locked = (await (await postLock(cookie)).json()) as DraftBody["draw"];

		const res = await postDraft([anna.id, bjorn.id], cookie, { startOver: true });

		expect(res.status).toBe(200);
		const body = (await res.json()) as DraftBody;
		expect(body.draw.id).not.toBe(locked.id);
		// The locked draw stays the official result until the new one is locked.
		expect(getLatestLockedDraw(db)!.id).toBe(locked.id);
	});

	it("doesn't ask for startOver again while re-rolling that new draft", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		await postDraft([anna.id, bjorn.id], cookie);
		await postLock(cookie);
		await postDraft([anna.id, bjorn.id], cookie, { startOver: true });

		// Nothing has been committed to since, so this is just another re-roll.
		expect((await postDraft([anna.id, bjorn.id], cookie)).status).toBe(200);
	});
});

// The fallback-to-allowing-repeats path is covered directly, and
// deterministically, in matching_logic.test.ts — a real locked draw is
// always a full permutation, which makes it genuinely hard to construct one
// that leaves the next draw unsolvable. What's worth pinning down here is
// that the route feeds last year's pairings in at all.
describe("avoiding last year's pairings", () => {
	it("doesn't repeat the locked draw's pairings in the next draw", async () => {
		const cookie = await asAdmin();
		const [anna, bjorn, carl] = [seed("Anna"), seed("Bjørn"), seed("Carl")];
		// Seeded directly rather than drawn, so "last year" is exact: with
		// three people there are only two possible assignments, and this is
		// one of them — leaving exactly one valid non-repeating answer.
		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, carl.id],
				[carl.id, anna.id],
			]),
		);
		lockDraft(db);

		const body = (await (
			await postDraft([anna.id, bjorn.id, carl.id], cookie, { startOver: true })
		).json()) as DraftBody;

		expect(body.repeatedLastYear).toBe(false);
		expect(new Map(body.draw.assignments.map((a) => [a.giverId, a.recipientId]))).toEqual(
			new Map([
				[anna.id, carl.id],
				[carl.id, bjorn.id],
				[bjorn.id, anna.id],
			]),
		);
	});

	it("reports no repeats when there was no previous draw to repeat", async () => {
		const cookie = await asAdmin();
		const ids = [seed("Anna"), seed("Bjørn"), seed("Carl")].map((p) => p.id);

		const body = (await (await postDraft(ids, cookie)).json()) as DraftBody;

		expect(body.repeatedLastYear).toBe(false);
	});
});

describe("a blind draw", () => {
	interface BlindBody {
		draw: {
			id: number;
			blind: boolean;
			participantIds: number[];
			assignments?: unknown;
		};
	}

	const seedTrioAsAdmin = async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const carl = seed("Carl");
		return { cookie, ids: [anna.id, bjorn.id, carl.id] };
	};

	it("withholds the pairings from the admin, while still saying who took part", async () => {
		const { cookie, ids } = await seedTrioAsAdmin();

		const body = (await (await postDraft(ids, cookie, { blind: true })).json()) as BlindBody;

		expect(body.draw.blind).toBe(true);
		expect(body.draw.participantIds.sort()).toEqual([...ids].sort());
		// Not merely unrendered by the client — absent from the response.
		expect(body.draw.assignments).toBeUndefined();
	});

	it("keeps them hidden on re-read, so a reload doesn't reveal them", async () => {
		const { cookie, ids } = await seedTrioAsAdmin();
		await postDraft(ids, cookie, { blind: true });

		const current = (await (await getCurrent(cookie)).json()) as BlindBody["draw"];

		expect(current.blind).toBe(true);
		expect(current.assignments).toBeUndefined();
	});

	it("keeps them hidden once locked in, when it matters most", async () => {
		const { cookie, ids } = await seedTrioAsAdmin();
		await postDraft(ids, cookie, { blind: true });

		const locked = (await (await postLock(cookie)).json()) as BlindBody["draw"];
		const current = (await (await getCurrent(cookie)).json()) as BlindBody["draw"];

		expect(locked.assignments).toBeUndefined();
		expect(current.assignments).toBeUndefined();
		// Whole-body check: no recipient id reaches the admin by any route.
		expect(JSON.stringify(locked)).not.toContain("recipientId");
	});

	it("hides by default, so forgetting the flag can't spoil a real draw", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const res = await app.request("/api/matcher/draft", {
			method: "POST",
			headers: { "Content-Type": "application/json", cookie },
			// No `blind` at all.
			body: JSON.stringify({ personIds: [anna.id, bjorn.id] }),
		});

		const body = (await res.json()) as BlindBody;
		expect(body.draw.blind).toBe(true);
		expect(body.draw.assignments).toBeUndefined();
	});

	it("still tells each person their own match once locked", async () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const carl = seed("Carl");
		const adminCookie = await asAdmin();
		const annaCookie = await loginAs("anna@example.com", anna.initialPassword);
		await postDraft([anna.id, bjorn.id, carl.id], adminCookie, { blind: true });
		await postLock(adminCookie);

		const mine = (await (
			await app.request("/api/matcher/mine", { headers: { cookie: annaCookie } })
		).json()) as { recipient: { name: string } | null };

		// Blind to the admin, not broken for everyone — Anna still gets hers.
		expect(mine.recipient).not.toBeNull();
		expect(["Bjørn", "Carl"]).toContain(mine.recipient!.name);
	});

	it("is still used as last year's pairings, which the server can read", async () => {
		const { cookie, ids } = await seedTrioAsAdmin();
		await postDraft(ids, cookie, { blind: true });
		await postLock(cookie);
		const lastYear = asPairs(getLatestLockedDraw(db)!);

		// Visible this time, so the test can check what it avoided.
		const body = (await (
			await postDraft(ids, cookie, { startOver: true, blind: false })
		).json()) as DraftBody;

		expect(body.repeatedLastYear).toBe(false);
		for (const assignment of body.draw.assignments) {
			expect(assignment.recipientId).not.toBe(lastYear.get(assignment.giverId));
		}
	});
});

describe("GET /api/matcher/mine", () => {
	const getMine = (cookie?: string) =>
		app.request("/api/matcher/mine", { headers: { ...(cookie && { cookie }) } });

	interface MineBody {
		recipient: { id: number; name: string } | null;
	}

	const seedTrio = async () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const carl = seed("Carl");
		const cookie = await loginAs("anna@example.com", anna.initialPassword);
		return { anna, bjorn, carl, cookie };
	};

	it("returns 401 without a session", async () => {
		expect((await getMine()).status).toBe(401);
	});

	it("is open to non-admins — it's their own match", async () => {
		const { anna, bjorn, carl, cookie } = await seedTrio();
		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, carl.id],
				[carl.id, anna.id],
			]),
		);
		lockDraft(db);

		const res = await getMine(cookie);

		expect(res.status).toBe(200);
		expect(((await res.json()) as MineBody).recipient).toEqual({ id: bjorn.id, name: "Bjørn" });
	});

	it("says nothing before a draw has been locked in", async () => {
		const { cookie } = await seedTrio();
		const res = await getMine(cookie);

		expect(res.status).toBe(200);
		expect(((await res.json()) as MineBody).recipient).toBeNull();
	});

	it("does not leak a draft — only a locked draw counts", async () => {
		const { anna, bjorn, carl, cookie } = await seedTrio();
		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, carl.id],
				[carl.id, anna.id],
			]),
		);

		// Drafted but not locked: the admin is still free to re-roll this, so
		// telling Anna now could tell her something that never happens.
		expect(((await (await getMine(cookie)).json()) as MineBody).recipient).toBeNull();
	});

	it("only ever reveals the caller's own recipient", async () => {
		const { anna, bjorn, carl, cookie } = await seedTrio();
		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, carl.id],
				[carl.id, anna.id],
			]),
		);
		lockDraft(db);

		const body = (await (await getMine(cookie)).json()) as MineBody;

		// Anna's own pairing, and nothing about who Bjørn or Carl drew.
		expect(body.recipient).toEqual({ id: bjorn.id, name: "Bjørn" });
		expect(JSON.stringify(body)).not.toContain("Carl");
	});

	it("says nothing for someone who wasn't in the draw", async () => {
		const { anna, bjorn, carl } = await seedTrio();
		const dina = seed("Dina");
		const dinaCookie = await loginAs("dina@example.com", dina.initialPassword);
		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, carl.id],
				[carl.id, anna.id],
			]),
		);
		lockDraft(db);

		expect(((await (await getMine(dinaCookie)).json()) as MineBody).recipient).toBeNull();
	});
});

describe("GET /api/matcher/current", () => {
	it("returns null before any draw has been run", async () => {
		const cookie = await asAdmin();
		const res = await getCurrent(cookie);

		expect(res.status).toBe(200);
		expect(await res.json()).toBeNull();
	});

	it("returns the locked draw once there's no draft in progress", async () => {
		const cookie = await asAdmin();
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		await postDraft([anna.id, bjorn.id], cookie);
		await postLock(cookie);

		const current = (await (await getCurrent(cookie)).json()) as DraftBody["draw"];

		expect(current.lockedAt).not.toBeNull();
		expect(current.assignments).toHaveLength(2);
	});
});
