import { eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "../db/client.js";
import { people, type PersonRow } from "../db/schema.js";
import { createInitialCredentials } from "../auth/service.js";

export const listPeople = (db: Db) => db.select().from(people).all();

/**
 * Fetches exactly the given people (in no particular order — may return
 * fewer rows than `ids` if some don't exist, callers should check).
 */
export const getPeopleByIds = (db: Db, ids: number[]): PersonRow[] =>
	db.select().from(people).where(inArray(people.id, ids)).all();

export interface NewPerson {
	name: string;
	email: string;
	phone: number;
	partnerId?: number | null;
}

export interface CreatedPerson extends PersonRow {
	/** Shown once, at creation time only — not retrievable afterwards. */
	initialPassword: string;
}

/**
 * Creates a person, along with login credentials with a freshly generated
 * initial password (see `createInitialCredentials`). If `partnerId` is
 * given, reciprocally links that partner back too (see `linkPartner` for
 * the unlink-previous-partner semantics that applies here as well).
 */
export const addPerson = (db: Db, input: NewPerson): CreatedPerson =>
	db.transaction((tx) => {
		const created = tx
			.insert(people)
			.values({ name: input.name, email: input.email, phone: input.phone })
			.returning()
			.get();

		const initialPassword = createInitialCredentials(tx, created.id);

		if (input.partnerId !== undefined && input.partnerId !== null) {
			linkPartner(tx, created.id, input.partnerId);
		}

		// Guaranteed to exist — we just inserted it in this same transaction.
		const person = tx.select().from(people).where(eq(people.id, created.id)).get()!;
		return { ...person, initialPassword };
	});

/** Removes a person, clearing the reciprocal link on their former partner, if any. */
export const removePerson = (db: Db, personId: number) =>
	db.transaction((tx) => {
		const former = tx.select().from(people).where(eq(people.partnerId, personId)).all();
		for (const person of former) {
			tx.update(people).set({ partnerId: null }).where(eq(people.id, person.id)).run();
		}
		tx.delete(people).where(eq(people.id, personId)).run();
	});

/**
 * Sets (or clears, when `partnerId` is `null`) the reciprocal partner link
 * between two people. Whoever the two were previously partnered with, if
 * anyone, is unlinked too, so no one is left pointing at a partner who no
 * longer points back. Returns false (and does nothing) if `personId` isn't
 * a real person, or if asked to partner someone with themselves.
 */
export const setPartner = (db: Db, personId: number, partnerId: number | null): boolean =>
	db.transaction((tx) => linkPartner(tx, personId, partnerId));

/** The actual linking logic, operating within an already-open transaction. */
const linkPartner = (tx: Tx, personId: number, partnerId: number | null): boolean => {
	if (partnerId === personId) {
		return false;
	}

	const person = tx.select().from(people).where(eq(people.id, personId)).get();
	if (!person) {
		return false;
	}

	const newPartner =
		partnerId === null ? undefined : tx.select().from(people).where(eq(people.id, partnerId)).get();
	if (partnerId !== null && !newPartner) {
		return false;
	}

	const previousPartner =
		person.partnerId !== null
			? tx.select().from(people).where(eq(people.id, person.partnerId)).get()
			: undefined;
	const newPartnersPreviousPartner =
		newPartner?.partnerId != null
			? tx.select().from(people).where(eq(people.id, newPartner.partnerId)).get()
			: undefined;

	if (previousPartner) {
		tx.update(people).set({ partnerId: null }).where(eq(people.id, previousPartner.id)).run();
	}
	if (newPartnersPreviousPartner) {
		tx.update(people)
			.set({ partnerId: null })
			.where(eq(people.id, newPartnersPreviousPartner.id))
			.run();
	}
	tx.update(people)
		.set({ partnerId: newPartner?.id ?? null })
		.where(eq(people.id, person.id))
		.run();
	if (newPartner) {
		tx.update(people).set({ partnerId: person.id }).where(eq(people.id, newPartner.id)).run();
	}

	return true;
};
