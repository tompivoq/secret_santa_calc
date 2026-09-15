import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";
import { addPerson, removePerson } from "../people/people.js";
import {
	asPairs,
	getCurrentDraw,
	getLatestLockedDraw,
	getLockedRecipientFor,
	hasDraft,
	hasLockedDraw,
	lockDraft,
	saveDraft,
} from "./draws.js";

let db: Db;

beforeEach(() => {
	db = createDb(":memory:");
	migrate(db, { migrationsFolder });
});

const seed = (name: string) =>
	addPerson(db, { name, email: `${name.toLowerCase()}@example.com`, phone: 22334455 });

describe("saveDraft", () => {
	it("stores the pairs as an unlocked draft", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");

		const draft = saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, anna.id],
			]),
		);

		expect(draft.lockedAt).toBeNull();
		expect(asPairs(draft)).toEqual(
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, anna.id],
			]),
		);
		expect(hasDraft(db)).toBe(true);
		expect(hasLockedDraw(db)).toBe(false);
	});

	it("replaces the previous draft rather than accumulating drafts", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const carl = seed("Carl");

		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, anna.id],
			]),
		);
		const second = saveDraft(
			db,
			new Map([
				[anna.id, carl.id],
				[carl.id, anna.id],
			]),
		);

		// Only the newest draft survives, and it's the one getCurrentDraw sees.
		expect(asPairs(getCurrentDraw(db)!)).toEqual(asPairs(second));
		expect(getCurrentDraw(db)!.id).toBe(second.id);
	});

	it("leaves a locked draw intact, starting a fresh draft alongside it", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const pairs = new Map([
			[anna.id, bjorn.id],
			[bjorn.id, anna.id],
		]);

		saveDraft(db, pairs);
		const lockedDraw = lockDraft(db)!;
		const draft = saveDraft(db, pairs);

		expect(draft.id).not.toBe(lockedDraw.id);
		// The locked draw survives as history, and stays the official result
		// until the new draft is locked in its turn.
		expect(getLatestLockedDraw(db)!.id).toBe(lockedDraw.id);
		expect(getCurrentDraw(db)!.id).toBe(draft.id);
	});
});

describe("lockDraft", () => {
	it("freezes the draft and makes it the latest locked draw", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const draft = saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, anna.id],
			]),
		);

		const locked = lockDraft(db)!;

		expect(locked.id).toBe(draft.id);
		expect(locked.lockedAt).toBeInstanceOf(Date);
		expect(asPairs(locked)).toEqual(asPairs(draft));
		expect(getLatestLockedDraw(db)!.id).toBe(draft.id);
		expect(hasDraft(db)).toBe(false);
	});

	it("returns null when there's nothing to lock", () => {
		expect(lockDraft(db)).toBeNull();
	});

	it("returns null rather than re-locking an already-locked draw", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		saveDraft(db, new Map([[anna.id, bjorn.id]]));
		lockDraft(db);

		expect(lockDraft(db)).toBeNull();
	});
});

describe("getLockedRecipientFor", () => {
	it("returns nothing while the draw is still only a draft", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, anna.id],
			]),
		);

		// The whole point: a draft is the admin's working copy, and must not
		// leak to the people it's about before it's locked in.
		expect(getLockedRecipientFor(db, anna.id)).toBeNull();
	});

	it("returns the recipient once the draw is locked", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, anna.id],
			]),
		);
		lockDraft(db);

		expect(getLockedRecipientFor(db, anna.id)?.recipientId).toBe(bjorn.id);
		expect(getLockedRecipientFor(db, bjorn.id)?.recipientId).toBe(anna.id);
	});

	it("reads the newest locked draw, not an older one", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const carl = seed("Carl");

		saveDraft(db, new Map([[anna.id, bjorn.id]]));
		lockDraft(db);
		saveDraft(db, new Map([[anna.id, carl.id]]));
		lockDraft(db);

		expect(getLockedRecipientFor(db, anna.id)?.recipientId).toBe(carl.id);
	});

	it("returns nothing for someone who wasn't part of the draw", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const excluded = seed("Excluded");
		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, anna.id],
			]),
		);
		lockDraft(db);

		expect(getLockedRecipientFor(db, excluded.id)).toBeNull();
	});
});

describe("deleting a person", () => {
	it("takes their assignments with them rather than leaving dangling rows", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const carl = seed("Carl");
		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, carl.id],
				[carl.id, anna.id],
			]),
		);
		lockDraft(db);

		removePerson(db, bjorn.id);

		// Both the row Bjørn gives in and the row he receives in are gone...
		const remaining = getLatestLockedDraw(db)!.assignments;
		expect(remaining.map((a) => a.giverId)).toEqual([carl.id]);
		// ...so Anna, who was giving to him, reads as unmatched rather than
		// pointing at someone who no longer exists.
		expect(getLockedRecipientFor(db, anna.id)).toBeNull();
		expect(getLockedRecipientFor(db, carl.id)?.recipientId).toBe(anna.id);
	});
});
