import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";
import type { Db, Tx } from "../db/client.js";
import { assignments, draws, type AssignmentRow, type DrawRow } from "../db/schema.js";

export interface Draw extends DrawRow {
	assignments: AssignmentRow[];
}

/** Either handle works for every read here — only saveDraft/lockDraft need the transactional one. */
type Handle = Db | Tx;

/** The unlocked draft, if one is waiting. At most one exists — see saveDraft. */
const selectDraft = (handle: Handle): DrawRow | undefined =>
	handle.select().from(draws).where(isNull(draws.lockedAt)).orderBy(desc(draws.id)).limit(1).get();

/** The most recently locked draw — the only one anyone but the admin is ever shown. */
const selectLocked = (handle: Handle): DrawRow | undefined =>
	handle
		.select()
		.from(draws)
		.where(isNotNull(draws.lockedAt))
		.orderBy(desc(draws.id))
		.limit(1)
		.get();

const selectAssignments = (handle: Handle, drawId: number): AssignmentRow[] =>
	handle.select().from(assignments).where(eq(assignments.drawId, drawId)).all();

const withAssignments = (handle: Handle, draw: DrawRow): Draw => ({
	...draw,
	assignments: selectAssignments(handle, draw.id),
});

/** giver id → recipient id, the shape the matching logic works in. */
export const asPairs = (draw: Draw): Map<number, number> =>
	new Map(draw.assignments.map((a) => [a.giverId, a.recipientId]));

/**
 * The draw the admin is currently looking at: the unlocked draft if there
 * is one, otherwise the most recently locked draw. Null before the first
 * draw has ever been run.
 */
export const getCurrentDraw = (db: Db): Draw | null => {
	const draw = db.select().from(draws).orderBy(desc(draws.id)).limit(1).get();
	return draw ? withAssignments(db, draw) : null;
};

/** The most recent locked-in draw, which repeat-avoidance treats as "last year". */
export const getLatestLockedDraw = (db: Db): Draw | null => {
	const draw = selectLocked(db);
	return draw ? withAssignments(db, draw) : null;
};

/** Whether a locked draw exists — i.e. whether a new draft would be a re-draw. */
export const hasLockedDraw = (db: Db): boolean => selectLocked(db) !== undefined;

/** True while a draft is waiting to be locked in or re-rolled. */
export const hasDraft = (db: Db): boolean => selectDraft(db) !== undefined;

/**
 * Replaces the current draft with a new one holding `pairs`. Any existing
 * draft is deleted outright (its assignments cascade) rather than added
 * to, keeping the "at most one draft" invariant that lets lockDraft() know
 * what it's locking without being told.
 *
 * Locked draws are never touched — they're history, and starting a fresh
 * draft alongside one is how a re-draw happens.
 */
export const saveDraft = (db: Db, pairs: Map<number, number>, blind = true): Draw =>
	db.transaction((tx) => {
		const existing = selectDraft(tx);
		if (existing) {
			tx.delete(draws).where(eq(draws.id, existing.id)).run();
		}

		const draw = tx.insert(draws).values({ createdAt: new Date(), blind }).returning().get();
		const rows = [...pairs].map(([giverId, recipientId]) => ({
			drawId: draw.id,
			giverId,
			recipientId,
		}));
		const saved = rows.length > 0 ? tx.insert(assignments).values(rows).returning().all() : [];

		return { ...draw, assignments: saved };
	});

/**
 * Locks the current draft in, freezing it as the result everyone will be
 * shown. Returns null if there's no draft to lock (nothing drafted yet, or
 * the latest draw is already locked) — the caller decides what that means
 * as a response.
 */
export const lockDraft = (db: Db): Draw | null =>
	db.transaction((tx) => {
		const draft = selectDraft(tx);
		if (!draft) {
			return null;
		}

		const locked = tx
			.update(draws)
			.set({ lockedAt: new Date() })
			.where(eq(draws.id, draft.id))
			.returning()
			.get();
		return withAssignments(tx, locked);
	});

/**
 * Who `personId` is giving to in the locked draw, if anyone. Deliberately
 * reads only locked draws: a draft is the admin's working copy and must
 * never leak to the people it's about.
 */
export const getLockedRecipientFor = (
	db: Db,
	personId: number,
): { recipientId: number; drawnAt: Date } | null => {
	const draw = selectLocked(db);
	if (!draw) {
		return null;
	}

	const assignment = db
		.select()
		.from(assignments)
		.where(and(eq(assignments.drawId, draw.id), eq(assignments.giverId, personId)))
		.get();
	// lockedAt is non-null by construction — this draw was selected on it.
	return assignment ? { recipientId: assignment.recipientId, drawnAt: draw.lockedAt! } : null;
};
