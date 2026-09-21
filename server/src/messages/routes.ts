import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import type { AuthVariables } from "../auth/types.js";
import type { Db } from "../db/client.js";
import type { PersonRow } from "../db/schema.js";
import { sendLoginLinks } from "../mail/loginLinks.js";
import type { Mailer } from "../mail/mailer.js";
import { answerReceivedEmail, questionReceivedEmail } from "../mail/messageEmails.js";
import {
	MAX_MESSAGE_LENGTH,
	answerQuestion,
	askQuestion,
	asReceived,
	getInbox,
} from "./messages.js";

const textSchema = z.string().trim().min(1).max(MAX_MESSAGE_LENGTH);

const askSchema = z.object({ recipientId: z.int(), question: textSchema });

const answerSchema = z.object({ answer: textSchema });

export interface MessagesOptions {
	mailer: Mailer;
	appBaseUrl: string;
}

/**
 * Anonymous questions between a giver and their recipient (or the
 * recipient's partner). Open to everyone signed in, and deliberately with
 * no admin view: the admin takes part in the draw like anyone else.
 */
export const getRoutes = (db: Db, authSecret: string, { mailer, appBaseUrl }: MessagesOptions) => {
	/**
	 * Tells `person` there's something waiting for them, with the same link
	 * rule as the match email. Returns whether it went out — a failed email
	 * doesn't undo the message, which is still there to be read in the app.
	 */
	const notify = async (person: PersonRow, compose: typeof questionReceivedEmail) => {
		const { sent, failed } = await sendLoginLinks(
			{ db, mailer, authSecret, appBaseUrl },
			[person],
			compose,
			() => {},
			{ magicLinkOnlyWithoutPassword: true },
		);
		for (const failure of failed) {
			// Who and why only — never the message, which isn't the log's to keep.
			console.warn(`[messages] could not email person ${failure.personId}: ${failure.error}`);
		}
		return sent.length > 0;
	};

	return new Hono<{ Variables: AuthVariables }>()
		.use("*", requireAuth(authSecret))
		.get("/", (c) => c.json(getInbox(db, c.get("personId"))))
		.post("/", zValidator("json", askSchema), async (c) => {
			const { recipientId, question } = c.req.valid("json");
			const result = askQuestion(db, c.get("personId"), recipientId, question);
			if (!result.ok) {
				return result.reason === "closed"
					? c.json({ error: "Messages open once the draw is locked in" }, 409)
					: c.json({ error: "You can only ask your recipient or their partner" }, 403);
			}

			const emailed = await notify(result.recipient, questionReceivedEmail);
			return c.json(
				{
					id: result.message.id,
					to: { id: result.recipient.id, name: result.recipient.name },
					question: result.message.question,
					askedAt: result.message.askedAt,
					answer: null,
					answeredAt: null,
					emailed,
				},
				201,
			);
		})
		.post("/:id/answer", zValidator("json", answerSchema), async (c) => {
			const id = Number(c.req.param("id"));
			if (!Number.isInteger(id)) {
				return c.json({ error: "Invalid id" }, 400);
			}

			const result = answerQuestion(db, c.get("personId"), id, c.req.valid("json").answer);
			if (!result.ok) {
				return result.reason === "not-found"
					? c.json({ error: "No such question" }, 404)
					: c.json({ error: "This question has already been answered" }, 409);
			}

			const emailed = await notify(result.sender, answerReceivedEmail);
			// The received view, not the row: the answerer still isn't told who asked.
			return c.json({ ...asReceived(result.message), emailed });
		});
};
