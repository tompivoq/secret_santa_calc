import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { addPerson, listPeople, removePerson, setPartner } from "./people.js";
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
