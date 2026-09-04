import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_LENGTH = 64;

/** Hashes a password with a random salt, using Node's built-in scrypt (no extra dependency). */
export const hashPassword = (password: string): string => {
	const salt = randomBytes(SALT_BYTES).toString("hex");
	const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
	return `${salt}:${hash}`;
};

/** Checks a password against a hash produced by {@link hashPassword}. */
export const verifyPassword = (password: string, stored: string): boolean => {
	const [salt, hash] = stored.split(":");
	if (!salt || !hash) {
		return false;
	}

	const candidate = scryptSync(password, salt, KEY_LENGTH);
	const expected = Buffer.from(hash, "hex");
	// Lengths must match before timingSafeEqual (it throws otherwise) — a
	// mismatch here just means "wrong password", not an error.
	return candidate.length === expected.length && timingSafeEqual(candidate, expected);
};

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/**
 * A random initial password for a newly created person, shown once to
 * whoever created them so it can be passed along. Excludes visually
 * ambiguous characters (0/O, 1/l/I) since it's meant to be typed by hand.
 */
export const generateInitialPassword = (length = 10): string => {
	const bytes = randomBytes(length);
	let password = "";
	for (let i = 0; i < length; i++) {
		password += PASSWORD_ALPHABET[bytes[i]! % PASSWORD_ALPHABET.length];
	}
	return password;
};
