import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { assignments } from "../db/schema.js";
import { issueMagicToken } from "../auth/magic.js";
import { matchReadyEmail } from "../mail/matchEmail.js";
import type { Mailer } from "../mail/mailer.js";
import { getPeopleByIds } from "../people/people.js";
import { getLatestLockedDraw } from "./draws.js";

export interface NotifyResult {
	notified: { personId: number; name: string }[];
	/** Per person, because one bad address must not decide the rest of the family's fate. */
	failed: { personId: number; name: string; error: string }[];
}

export interface NotifyOptions {
	/**
	 * Who to write to. Omitted means everyone in the locked draw who hasn't
	 * been emailed yet; naming people re-sends to exactly those, whether or
	 * not they've had one already.
	 */
	personIds?: number[] | undefined;
}

/**
 * Emails people a link to their match in the current locked draw.
 *
 * Only ever the locked draw: a draft is still free to change, so telling
 * anyone about one would be telling them something that may not happen.
 * Returns null when there's nothing locked to notify about.
 */
export const notifyParticipants = async (
	db: Db,
	mailer: Mailer,
	authSecret: string,
	appBaseUrl: string,
	options: NotifyOptions = {},
): Promise<NotifyResult | null> => {
	const draw = getLatestLockedDraw(db);
	if (!draw) {
		return null;
	}

	const targets =
		options.personIds === undefined
			? draw.assignments.filter((assignment) => assignment.notifiedAt === null)
			: draw.assignments.filter((assignment) => options.personIds!.includes(assignment.giverId));

	const peopleById = new Map(
		getPeopleByIds(
			db,
			targets.map((assignment) => assignment.giverId),
		).map((person) => [person.id, person]),
	);

	const result: NotifyResult = { notified: [], failed: [] };

	// Sequential rather than Promise.all: this is a handful of relatives, and
	// a provider rate-limiting a burst would turn a slow send into a failed one.
	for (const assignment of targets) {
		const person = peopleById.get(assignment.giverId);
		if (!person) {
			continue;
		}

		try {
			const token = await issueMagicToken(db, person.id, authSecret);
			if (token === null) {
				throw new Error("No login credentials to build a link from");
			}

			await mailer.send({
				to: person.email,
				...matchReadyEmail({
					name: person.name,
					loginUrl: `${appBaseUrl}/api/auth/magic/${token}`,
				}),
			});

			// Only after the send actually succeeded — marking first would let a
			// failed send masquerade as a delivered one and be skipped forever after.
			db.update(assignments)
				.set({ notifiedAt: new Date() })
				.where(eq(assignments.id, assignment.id))
				.run();
			result.notified.push({ personId: person.id, name: person.name });
		} catch (error) {
			result.failed.push({
				personId: person.id,
				name: person.name,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	return result;
};

/** How many people in the locked draw are still waiting to be told. */
export const countUnnotified = (db: Db): number => {
	const draw = getLatestLockedDraw(db);
	if (!draw) {
		return 0;
	}
	return draw.assignments.filter((assignment) => assignment.notifiedAt === null).length;
};
