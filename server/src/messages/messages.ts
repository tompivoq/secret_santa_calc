import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { messages, type MessageRow, type PersonRow } from "../db/schema.js";
import { getPeopleByIds } from "../people/people.js";
import { getLatestLockedDraw } from "../matcher/draws.js";

/** Long enough for "are you free on the 12th, or the 14th?", short enough to stay a note. */
export const MAX_MESSAGE_LENGTH = 1000;

/**
 * A question as its sender sees it. Includes whom it went to — the sender
 * chose them, so it tells them nothing new.
 */
export interface SentQuestion {
	id: number;
	to: { id: number; name: string };
	question: string;
	askedAt: Date;
	answer: string | null;
	answeredAt: Date | null;
}

/**
 * A question as its recipient sees it. Built field by field rather than
 * by leaving things out of a row, so nothing about who asked — or whether
 * they were asked as the target or as the target's partner — can slip in
 * when the table grows a column.
 */
export interface ReceivedQuestion {
	id: number;
	question: string;
	askedAt: Date;
	answer: string | null;
	answeredAt: Date | null;
}

export interface Inbox {
	/** False until a draw has been locked in; nothing below applies before that. */
	open: boolean;
	/** Who this person may ask: their recipient, and that person's partner if they have one. */
	canAsk: { id: number; name: string }[];
	sent: SentQuestion[];
	received: ReceivedQuestion[];
}

export const asReceived = (message: MessageRow): ReceivedQuestion => ({
	id: message.id,
	question: message.question,
	askedAt: message.askedAt,
	answer: message.answer,
	answeredAt: message.answeredAt,
});

/**
 * Who `personId` may put a question to in the current locked draw, or null
 * when nothing is locked in. Empty for someone who isn't giving in it —
 * a partner outside the draw can be asked, but has no one to ask.
 */
const askable = (db: Db, personId: number): { drawId: number; people: PersonRow[] } | null => {
	const draw = getLatestLockedDraw(db);
	if (!draw) {
		return null;
	}

	const mine = draw.assignments.find((assignment) => assignment.giverId === personId);
	if (!mine) {
		return { drawId: draw.id, people: [] };
	}

	const target = getPeopleByIds(db, [mine.recipientId])[0];
	if (!target) {
		return { drawId: draw.id, people: [] };
	}
	const partner =
		target.partnerId !== null && target.partnerId !== personId
			? getPeopleByIds(db, [target.partnerId])[0]
			: undefined;

	return { drawId: draw.id, people: partner ? [target, partner] : [target] };
};

/**
 * Everything this person can see about messages in the current draw: who
 * they may ask, what they've asked, and what they've been asked.
 *
 * Only the current (latest locked) draw — a re-draw leaves questions about
 * the old pairings behind, since their answers may no longer mean anything.
 */
export const getInbox = (db: Db, personId: number): Inbox => {
	const allowed = askable(db, personId);
	if (!allowed) {
		return { open: false, canAsk: [], sent: [], received: [] };
	}

	const sentRows = db
		.select()
		.from(messages)
		.where(and(eq(messages.drawId, allowed.drawId), eq(messages.senderId, personId)))
		.orderBy(asc(messages.id))
		.all();
	const namesById = new Map(
		getPeopleByIds(db, [...new Set(sentRows.map((row) => row.recipientId))]).map((person) => [
			person.id,
			person.name,
		]),
	);

	const receivedRows = db
		.select()
		.from(messages)
		.where(and(eq(messages.drawId, allowed.drawId), eq(messages.recipientId, personId)))
		.orderBy(asc(messages.id))
		.all();

	return {
		open: true,
		canAsk: allowed.people.map((person) => ({ id: person.id, name: person.name })),
		sent: sentRows.map((row) => ({
			id: row.id,
			to: { id: row.recipientId, name: namesById.get(row.recipientId) ?? "Ukendt" },
			question: row.question,
			askedAt: row.askedAt,
			answer: row.answer,
			answeredAt: row.answeredAt,
		})),
		received: receivedRows.map(asReceived),
	};
};

export type AskResult =
	| { ok: true; message: MessageRow; recipient: PersonRow }
	| { ok: false; reason: "closed" | "not-allowed" };

/**
 * Stores a question from `senderId` to `recipientId`, provided the latter
 * is the sender's recipient in the locked draw, or that person's partner.
 */
export const askQuestion = (
	db: Db,
	senderId: number,
	recipientId: number,
	question: string,
): AskResult => {
	const allowed = askable(db, senderId);
	if (!allowed) {
		return { ok: false, reason: "closed" };
	}
	const recipient = allowed.people.find((person) => person.id === recipientId);
	if (!recipient) {
		return { ok: false, reason: "not-allowed" };
	}

	const message = db
		.insert(messages)
		.values({ drawId: allowed.drawId, senderId, recipientId, question, askedAt: new Date() })
		.returning()
		.get();
	return { ok: true, message, recipient };
};

export type AnswerResult =
	| { ok: true; message: MessageRow; sender: PersonRow }
	| { ok: false; reason: "not-found" | "already-answered" };

/**
 * Records `personId`'s answer to a question they were asked in the current
 * draw. Only once: an answer the asker may already have acted on shouldn't
 * change under them.
 *
 * Anyone else's question, and anything from an earlier draw, is reported as
 * not found rather than forbidden — whether a given id exists is itself
 * none of their business.
 */
export const answerQuestion = (
	db: Db,
	personId: number,
	messageId: number,
	answer: string,
): AnswerResult => {
	const draw = getLatestLockedDraw(db);
	const message = db.select().from(messages).where(eq(messages.id, messageId)).get();
	if (!draw || !message || message.recipientId !== personId || message.drawId !== draw.id) {
		return { ok: false, reason: "not-found" };
	}

	// Conditional on still being unanswered, so two answers racing each
	// other can't both land — the loser updates nothing and is told so.
	const updated = db
		.update(messages)
		.set({ answer, answeredAt: new Date() })
		.where(and(eq(messages.id, messageId), isNull(messages.answer)))
		.returning()
		.get();
	if (!updated) {
		return { ok: false, reason: "already-answered" };
	}

	const sender = getPeopleByIds(db, [message.senderId])[0];
	if (!sender) {
		// Unreachable: deleting the sender cascades to their messages.
		return { ok: false, reason: "not-found" };
	}
	return { ok: true, message: updated, sender };
};
