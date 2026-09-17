import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { credentials, type PersonRow } from "../db/schema.js";
import { issueMagicToken } from "../auth/magic.js";
import type { MailMessage, Mailer } from "./mailer.js";

export interface LoginLinkEmailInput {
	/** Who's being written to. */
	name: string;
	/**
	 * Where the email's link goes, already built against APP_BASE_URL: a
	 * single-use login link, or — see magicLinkOnlyWithoutPassword — just the
	 * account page.
	 */
	loginUrl: string;
}

export interface LoginLinkMailContext {
	db: Db;
	mailer: Mailer;
	authSecret: string;
	appBaseUrl: string;
}

export interface SendLoginLinksOptions {
	/**
	 * Give anyone who has already chosen their own password a plain link to
	 * their account page instead of a magic link. They can log in the usual
	 * way, and there's no reason to put a working login link in their inbox —
	 * or to spend one they may still have. Anyone still on their initial
	 * password gets a magic link regardless, since they have nothing else to
	 * log in with.
	 */
	magicLinkOnlyWithoutPassword?: boolean;
}

export interface SendLoginLinksResult {
	sent: { personId: number; name: string }[];
	/** Per person, because one bad address must not decide the rest of the family's fate. */
	failed: { personId: number; name: string; error: string }[];
}

/**
 * Emails each person a fresh login link, written by `compose`, and calls
 * `onSent` for each one that actually went out.
 *
 * Shared by everything that writes to people with a link in hand — an
 * invitation before the draw, or the news that it's been made — so that
 * what counts as sent, and how a failure is reported, can't drift apart.
 * Issuing a link invalidates any earlier one for that person.
 */
export const sendLoginLinks = async (
	{ db, mailer, authSecret, appBaseUrl }: LoginLinkMailContext,
	people: PersonRow[],
	compose: (input: LoginLinkEmailInput) => Omit<MailMessage, "to">,
	onSent: (person: PersonRow) => void,
	{ magicLinkOnlyWithoutPassword = false }: SendLoginLinksOptions = {},
): Promise<SendLoginLinksResult> => {
	const result: SendLoginLinksResult = { sent: [], failed: [] };

	// Sequential rather than Promise.all: this is a handful of relatives, and
	// a provider rate-limiting a burst would turn a slow send into a failed one.
	for (const person of people) {
		try {
			const creds = db.select().from(credentials).where(eq(credentials.personId, person.id)).get();
			if (!creds) {
				throw new Error(
					"Personen har ingen login-oplysninger, så der kunne ikke laves et login-link",
				);
			}

			let loginUrl: string;
			if (magicLinkOnlyWithoutPassword && !creds.mustChangePassword) {
				// The login page lands on /account too, so this gets them there
				// whether or not they're still logged in on that device.
				loginUrl = `${appBaseUrl}/account`;
			} else {
				// Only null if the credentials vanished since the lookup above.
				const token = await issueMagicToken(db, person.id, authSecret);
				if (token === null) {
					throw new Error(
						"Personen har ingen login-oplysninger, så der kunne ikke laves et login-link",
					);
				}
				loginUrl = `${appBaseUrl}/api/auth/magic/${token}`;
			}

			await mailer.send({ to: person.email, ...compose({ name: person.name, loginUrl }) });

			// Only after the send actually succeeded — marking first would let a
			// failed send masquerade as a delivered one and be skipped forever after.
			onSent(person);
			result.sent.push({ personId: person.id, name: person.name });
		} catch (error) {
			result.failed.push({
				personId: person.id,
				name: person.name,
				// Shown to the admin as-is next to the person's name, so it's in
				// Danish where it's ours to write. A rejected send passes through
				// the mailer's message instead, which includes the provider's own
				// (English) explanation — see mail/mailer.ts.
				error: error instanceof Error ? error.message : "Ukendt fejl",
			});
		}
	}

	return result;
};
