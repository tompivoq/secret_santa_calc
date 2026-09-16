import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
	addPerson,
	listPeople,
	removePerson,
	setLastYearRecipient,
	setPartner,
	updatePerson,
} from "./people.js";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";

let db: Db;

beforeEach(() => {
	db = createDb(":memory:");
	migrate(db, { migrationsFolder });
});

const seed = (name: string, partnerId?: number) =>
	addPerson(db, { name, email: `${name.toLowerCase()}@example.com`, phone: 22334455, partnerId });

describe("addPerson", () => {
	it("creates a person with an auto-assigned id", () => {
		const anna = seed("Anna");
		expect(anna).toMatchObject({ name: "Anna", email: "anna@example.com", phone: 22334455 });
		expect(anna.id).toBeTypeOf("number");
	});

	it("reciprocally links the partner chosen at creation time", () => {
		const bjorn = seed("Bjørn");
		const anna = seed("Anna", bjorn.id);

		const people = listPeople(db);
		expect(people.find((p) => p.id === bjorn.id)?.partnerId).toBe(anna.id);
		expect(anna.partnerId).toBe(bjorn.id);
	});

	it("unlinks the chosen partner's previous partner", () => {
		const bjorn = seed("Bjørn");
		const carl = seed("Carl", bjorn.id);
		const anna = seed("Anna", bjorn.id);

		const people = listPeople(db);
		expect(people.find((p) => p.id === bjorn.id)?.partnerId).toBe(anna.id);
		expect(people.find((p) => p.id === carl.id)?.partnerId).toBeNull();
	});
});

describe("setPartner", () => {
	it("links two people reciprocally", () => {
		const bjorn = seed("Bjørn");
		const anna = seed("Anna");

		const ok = setPartner(db, bjorn.id, anna.id);

		expect(ok).toBe(true);
		const people = listPeople(db);
		expect(people.find((p) => p.id === bjorn.id)?.partnerId).toBe(anna.id);
		expect(people.find((p) => p.id === anna.id)?.partnerId).toBe(bjorn.id);
	});

	it("clears the partner when partnerId is null", () => {
		const bjorn = seed("Bjørn");
		const anna = seed("Anna", bjorn.id);
		setPartner(db, bjorn.id, anna.id);

		setPartner(db, bjorn.id, null);

		const people = listPeople(db);
		expect(people.find((p) => p.id === bjorn.id)?.partnerId).toBeNull();
		expect(people.find((p) => p.id === anna.id)?.partnerId).toBeNull();
	});

	it("unlinks the previous partner when switching to a new one", () => {
		const bjorn = seed("Bjørn");
		const anna = seed("Anna", bjorn.id);
		const carl = seed("Carl");

		setPartner(db, bjorn.id, carl.id);

		const people = listPeople(db);
		expect(people.find((p) => p.id === bjorn.id)?.partnerId).toBe(carl.id);
		expect(people.find((p) => p.id === carl.id)?.partnerId).toBe(bjorn.id);
		expect(people.find((p) => p.id === anna.id)?.partnerId).toBeNull();
	});

	it("unlinks the new partner from their previous partner too", () => {
		const bjorn = seed("Bjørn");
		const anna = seed("Anna", bjorn.id);
		const carl = seed("Carl");
		const dana = seed("Dana", carl.id);

		setPartner(db, bjorn.id, carl.id);

		const people = listPeople(db);
		expect(people.find((p) => p.id === bjorn.id)?.partnerId).toBe(carl.id);
		expect(people.find((p) => p.id === carl.id)?.partnerId).toBe(bjorn.id);
		expect(people.find((p) => p.id === anna.id)?.partnerId).toBeNull();
		expect(people.find((p) => p.id === dana.id)?.partnerId).toBeNull();
	});

	it("is a no-op when the person does not exist", () => {
		const bjorn = seed("Bjørn");
		const ok = setPartner(db, 99, bjorn.id);
		expect(ok).toBe(false);
	});

	it("is a no-op when the target partner does not exist", () => {
		const bjorn = seed("Bjørn");
		const ok = setPartner(db, bjorn.id, 99);
		expect(ok).toBe(false);
		expect(listPeople(db).find((p) => p.id === bjorn.id)?.partnerId).toBeNull();
	});

	it("is a no-op when trying to partner a person with themselves", () => {
		const bjorn = seed("Bjørn");
		const ok = setPartner(db, bjorn.id, bjorn.id);
		expect(ok).toBe(false);
	});
});

describe("removePerson", () => {
	it("removes the person from the list", () => {
		const bjorn = seed("Bjørn");
		seed("Anna");

		removePerson(db, bjorn.id);

		const people = listPeople(db);
		expect(people).toHaveLength(1);
		expect(people.find((p) => p.id === bjorn.id)).toBeUndefined();
	});

	it("clears the removed person's partner link on their former partner", () => {
		const bjorn = seed("Bjørn");
		const anna = seed("Anna", bjorn.id);

		removePerson(db, bjorn.id);

		expect(listPeople(db).find((p) => p.id === anna.id)?.partnerId).toBeNull();
	});
});

describe("setLastYearRecipient", () => {
	it("records who someone gave to last year", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");

		expect(setLastYearRecipient(db, anna.id, bjorn.id)).toBe(true);

		expect(listPeople(db).find((p) => p.id === anna.id)?.lastYearRecipientId).toBe(bjorn.id);
	});

	it("sets nothing on the recipient — giving is one-directional", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");

		setLastYearRecipient(db, anna.id, bjorn.id);

		// Who gave to Bjørn last year is a separate fact, not the mirror of this.
		expect(listPeople(db).find((p) => p.id === bjorn.id)?.lastYearRecipientId).toBeNull();
	});

	it("clears it when given null", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		setLastYearRecipient(db, anna.id, bjorn.id);

		expect(setLastYearRecipient(db, anna.id, null)).toBe(true);

		expect(listPeople(db).find((p) => p.id === anna.id)?.lastYearRecipientId).toBeNull();
	});

	it("refuses to point someone at themselves", () => {
		const anna = seed("Anna");

		expect(setLastYearRecipient(db, anna.id, anna.id)).toBe(false);

		expect(listPeople(db).find((p) => p.id === anna.id)?.lastYearRecipientId).toBeNull();
	});

	it("refuses a recipient who doesn't exist", () => {
		const anna = seed("Anna");
		expect(setLastYearRecipient(db, anna.id, 999_999)).toBe(false);
	});

	it("refuses to set it on someone who doesn't exist", () => {
		const anna = seed("Anna");
		expect(setLastYearRecipient(db, 999_999, anna.id)).toBe(false);
	});

	it("is cleared on everyone pointing at a person who gets removed", () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		setLastYearRecipient(db, anna.id, bjorn.id);

		removePerson(db, bjorn.id);

		// Rather than leaving Anna pointing at someone who no longer exists.
		expect(listPeople(db).find((p) => p.id === anna.id)?.lastYearRecipientId).toBeNull();
	});
});

describe("updatePerson", () => {
	it("changes only the fields it is given", () => {
		const anna = seed("Anna");

		const result = updatePerson(db, anna.id, { name: "Anna Marie" });

		expect(result.ok).toBe(true);
		const updated = listPeople(db).find((p) => p.id === anna.id)!;
		expect(updated.name).toBe("Anna Marie");
		expect(updated.email).toBe("anna@example.com");
		expect(updated.phone).toBe(22334455);
	});

	it("applies details, partner and last year's match in one go", () => {
		const bjorn = seed("Bjørn");
		const carl = seed("Carl");
		const anna = seed("Anna");

		updatePerson(db, anna.id, {
			name: "Anna Marie",
			phone: 99887766,
			partnerId: bjorn.id,
			lastYearRecipientId: carl.id,
		});

		const updated = listPeople(db).find((p) => p.id === anna.id)!;
		expect(updated).toMatchObject({
			name: "Anna Marie",
			phone: 99887766,
			partnerId: bjorn.id,
			lastYearRecipientId: carl.id,
		});
		// Partner linking stays reciprocal, as it is everywhere else.
		expect(listPeople(db).find((p) => p.id === bjorn.id)?.partnerId).toBe(anna.id);
	});

	it("clears a partner when given null", () => {
		const bjorn = seed("Bjørn");
		const anna = seed("Anna", bjorn.id);

		updatePerson(db, anna.id, { partnerId: null });

		expect(listPeople(db).find((p) => p.id === anna.id)?.partnerId).toBeNull();
		expect(listPeople(db).find((p) => p.id === bjorn.id)?.partnerId).toBeNull();
	});

	it("reports an unknown person rather than creating one", () => {
		expect(updatePerson(db, 999_999, { name: "Nobody" })).toEqual({
			ok: false,
			reason: "not-found",
		});
	});

	it("rejects a partner who doesn't exist, without applying the rest", () => {
		const anna = seed("Anna");

		const result = updatePerson(db, anna.id, { name: "Anna Marie", partnerId: 999_999 });

		expect(result).toEqual({ ok: false, reason: "invalid-partner" });
		// The whole edit is refused, not half of it — the name is untouched.
		expect(listPeople(db).find((p) => p.id === anna.id)?.name).toBe("Anna");
	});

	it("rejects making someone their own partner or their own last year's match", () => {
		const anna = seed("Anna");

		expect(updatePerson(db, anna.id, { partnerId: anna.id })).toEqual({
			ok: false,
			reason: "invalid-partner",
		});
		expect(updatePerson(db, anna.id, { lastYearRecipientId: anna.id })).toEqual({
			ok: false,
			reason: "invalid-last-year",
		});
	});

	it("refuses an email that belongs to someone else", () => {
		seed("Bjørn");
		const anna = seed("Anna");

		// Surfaced as the unique-constraint error the route turns into a 409.
		expect(() => updatePerson(db, anna.id, { email: "bjørn@example.com" })).toThrow();
	});
});
