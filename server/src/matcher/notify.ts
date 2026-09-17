import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { assignments } from "../db/schema.js";
import { matchReadyEmail } from "../mail/matchEmail.js";
import type { Mailer } from "../mail/mailer.js";
import { sendLoginLinks, type SendLoginLinksResult } from "../mail/loginLinks.js";
import { getPeopleByIds } from "../people/people.js";
import { getLatestLockedDraw } from "./draws.js";

export interface NotifyResult {
	notified: SendLoginLinksResult["sent"];
	failed: SendLoginLinksResult["failed"];
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

	const assignmentIdByGiver = new Map(
		targets.map((assignment) => [assignment.giverId, assignment.id]),
	);
	// Ordered as the draw is, not as the lookup happens to return them.
	const peopleById = new Map(
		getPeopleByIds(db, [...assignmentIdByGiver.keys()]).map((person) => [person.id, person]),
	);
	const recipients = targets.flatMap((assignment) => peopleById.get(assignment.giverId) ?? []);

	const { sent, failed } = await sendLoginLinks(
		{ db, mailer, authSecret, appBaseUrl },
		recipients,
		matchReadyEmail,
		(person) =>
			db
				.update(assignments)
				.set({ notifiedAt: new Date() })
				.where(eq(assignments.id, assignmentIdByGiver.get(person.id)!))
				.run(),
	);

	return { notified: sent, failed };
};

/** How many people in the locked draw are still waiting to be told. */
export const countUnnotified = (db: Db): number => {
	const draw = getLatestLockedDraw(db);
	if (!draw) {
		return 0;
	}
	return draw.assignments.filter((assignment) => assignment.notifiedAt === null).length;
};
