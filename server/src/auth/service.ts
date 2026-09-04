import { eq } from "drizzle-orm";
import type { Db, Tx } from "../db/client.js";
import { credentials, lower, people, type PersonRow } from "../db/schema.js";
import { generateInitialPassword, hashPassword, verifyPassword } from "./password.js";

/**
 * Creates login credentials for a freshly created person, within the same
 * transaction that created them. Returns the plaintext initial password —
 * it is never stored or retrievable again, so the caller must hand it to
 * whoever is setting the person up right now.
 */
export const createInitialCredentials = (tx: Tx, personId: number): string => {
	const initialPassword = generateInitialPassword();
	tx.insert(credentials)
		.values({
			personId,
			passwordHash: hashPassword(initialPassword),
			mustChangePassword: true,
		})
		.run();
	return initialPassword;
};

export interface LoginResult {
	person: PersonRow;
	mustChangePassword: boolean;
}

/** Verifies an email/password pair. Returns null on any mismatch (unknown email, wrong password, no credentials set up). */
export const login = (db: Db, email: string, password: string): LoginResult | null => {
	const person = db
		.select()
		.from(people)
		.where(eq(lower(people.email), email.toLowerCase()))
		.get();
	if (!person) {
		return null;
	}

	const creds = db.select().from(credentials).where(eq(credentials.personId, person.id)).get();
	if (!creds || !verifyPassword(password, creds.passwordHash)) {
		return null;
	}

	return { person, mustChangePassword: creds.mustChangePassword };
};

/** Whether a person still needs to replace their initial password. False if they have no credentials at all. */
export const getMustChangePassword = (db: Db, personId: number): boolean => {
	const creds = db.select().from(credentials).where(eq(credentials.personId, personId)).get();
	return creds?.mustChangePassword ?? false;
};

/**
 * Changes a person's password, provided they know their current one —
 * required even when `mustChangePassword` is set, so a stolen/guessed
 * initial password alone isn't enough to lock the real person out.
 * Returns false if there are no credentials for this person, or the
 * current password given doesn't match.
 */
export const changePassword = (
	db: Db,
	personId: number,
	currentPassword: string,
	newPassword: string,
): boolean => {
	const creds = db.select().from(credentials).where(eq(credentials.personId, personId)).get();
	if (!creds || !verifyPassword(currentPassword, creds.passwordHash)) {
		return false;
	}

	db.update(credentials)
		.set({ passwordHash: hashPassword(newPassword), mustChangePassword: false })
		.where(eq(credentials.personId, personId))
		.run();
	return true;
};
