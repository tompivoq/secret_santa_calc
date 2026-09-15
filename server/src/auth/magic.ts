import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { sign, verify } from "hono/jwt";
import type { Db } from "../db/client.js";
import { credentials } from "../db/schema.js";

/**
 * Long enough that someone who doesn't check their email for a week can
 * still get in — this app is used once a year, so a link that expires in
 * an hour would mostly be a link that expires unused.
 */
const MAGIC_LIFETIME_SECONDS = 60 * 60 * 24 * 14; // 14 days

const MAGIC_PURPOSE = "magic";

interface MagicPayload {
	[key: string]: unknown;
	personId: number;
	/** Matched against the stored id — see credentials.magicTokenId. */
	jti: string;
	purpose: string;
	exp: number;
}

/**
 * Mints a single-use login link token for `personId`, invalidating any
 * link issued to them previously. Returns null if they have no credentials
 * row to hang it off, which in practice means no such person.
 */
export const issueMagicToken = async (
	db: Db,
	personId: number,
	secret: string,
): Promise<string | null> => {
	const creds = db.select().from(credentials).where(eq(credentials.personId, personId)).get();
	if (!creds) {
		return null;
	}

	const jti = randomUUID();
	const payload: MagicPayload = {
		personId,
		jti,
		purpose: MAGIC_PURPOSE,
		exp: Math.floor(Date.now() / 1000) + MAGIC_LIFETIME_SECONDS,
	};
	const token = await sign(payload, secret, "HS256");

	db.update(credentials).set({ magicTokenId: jti }).where(eq(credentials.personId, personId)).run();
	return token;
};

/**
 * Verifies a magic-link token and spends it, returning whose it was.
 * Returns null for anything not currently valid: a bad signature, an
 * expired link, a session cookie presented as a link, or — the point of
 * storing the id — a link that has already been followed, or that was
 * superseded by a newer one.
 */
export const consumeMagicToken = async (
	db: Db,
	token: string,
	secret: string,
): Promise<number | null> => {
	let payload: MagicPayload;
	try {
		payload = (await verify(token, secret, "HS256")) as unknown as MagicPayload;
	} catch {
		return null;
	}

	if (payload.purpose !== MAGIC_PURPOSE) {
		return null;
	}

	const creds = db
		.select()
		.from(credentials)
		.where(eq(credentials.personId, payload.personId))
		.get();
	if (!creds || creds.magicTokenId === null || creds.magicTokenId !== payload.jti) {
		return null;
	}

	// Spend it before returning, so a second use of the same link fails even
	// if the two arrive together.
	db.update(credentials)
		.set({ magicTokenId: null })
		.where(eq(credentials.personId, payload.personId))
		.run();

	// Deliberately leaves mustChangePassword alone. Someone who has never
	// chosen a password still needs to, and the session this link produces
	// is what lets them do it without being asked for the one they don't
	// know — see the change-password route.
	return payload.personId;
};
