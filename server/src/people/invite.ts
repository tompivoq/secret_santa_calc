import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { credentials, people } from "../db/schema.js";
import { inviteEmail } from "../mail/inviteEmail.js";
import type { Mailer } from "../mail/mailer.js";
import { sendLoginLinks, type SendLoginLinksResult } from "../mail/loginLinks.js";
import { getPeopleByIds } from "./people.js";

export interface InviteResult {
	invited: SendLoginLinksResult["sent"];
	failed: SendLoginLinksResult["failed"];
}

export interface InviteOptions {
	/**
	 * Who to invite. Omitted means everyone still waiting for one (see
	 * awaitingInvitation); naming people sends to exactly those, whether or
	 * not they've been invited or logged in already.
	 */
	personIds?: number[] | undefined;
}

/**
 * Everyone who has neither been invited nor got in on their own: no
 * invitation sent, and still on the password they were created with.
 *
 * The second half is what keeps "invite everyone" from emailing the admin
 * who's clicking it — or anyone else who was handed their initial password
 * in person and has already used it.
 */
const awaitingInvitation = (db: Db) =>
	db
		.select({ person: people })
		.from(people)
		.innerJoin(credentials, eq(credentials.personId, people.id))
		.where(and(isNull(people.invitedAt), eq(credentials.mustChangePassword, true)))
		.all()
		.map((row) => row.person);

/**
 * Emails people a login link ahead of the draw, so they can get in and
 * choose a password while nothing is at stake yet.
 *
 * Unlike notifying about a match, this needs no draw at all — that's the
 * point of it — and can be sent to anyone on the list at any time.
 */
export const invitePeople = async (
	db: Db,
	mailer: Mailer,
	authSecret: string,
	appBaseUrl: string,
	options: InviteOptions = {},
): Promise<InviteResult> => {
	const targets =
		options.personIds === undefined
			? awaitingInvitation(db)
			: getPeopleByIds(db, options.personIds);

	const { sent, failed } = await sendLoginLinks(
		{ db, mailer, authSecret, appBaseUrl },
		targets,
		inviteEmail,
		(person) =>
			db.update(people).set({ invitedAt: new Date() }).where(eq(people.id, person.id)).run(),
	);

	return { invited: sent, failed };
};
