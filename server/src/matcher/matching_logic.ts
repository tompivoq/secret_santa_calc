import type { PersonRow } from "../db/schema.js";

export interface MatchingPerson extends PersonRow {
	hasMatch: boolean;
	currentTarget?: number | null;
}

/** Whether `giver` is allowed to be matched to give a gift to `receiver`. */
const canGiveTo = (giver: MatchingPerson, receiver: MatchingPerson): boolean =>
	giver.id !== receiver.id && giver.partnerId !== receiver.id;
// Not wired up yet — `last_year_recipient` isn't a real column (see
// TODO.md), but once it is, it's one more clause here:
// && giver.lastYearRecipientId !== receiver.id

/**
 * Assigns every person a valid recipient (excluding themselves and their
 * partner), or returns null if no valid assignment exists at all.
 *
 * Uses backtracking rather than "generate a random full assignment, and
 * restart from scratch if anyone gets stuck": a dead end only costs one
 * step back, not the whole search, and — critically — nothing is written
 * to `people` until a complete, verified-valid assignment is found. There
 * is no partial/discarded state left lying around to leak into a retry.
 */
export const doMatching = (people: MatchingPerson[]): MatchingPerson[] | null => {
	// Fail fast, with a clear reason, instead of only discovering
	// infeasibility after exhausting a search that could never succeed —
	// e.g. two people whose only allowed recipient is each other's partner.
	const withoutCandidates = people.filter(
		(giver) => !people.some((receiver) => canGiveTo(giver, receiver)),
	);
	if (withoutCandidates.length > 0) {
		return null;
	}

	const assignments = assign(people, people);
	if (!assignments) {
		return null;
	}

	return people.map((person) => ({
		...person,
		hasMatch: true,
		currentTarget: assignments.get(person.id)!,
	}));
};

/**
 * Recursively gives each of `givers` a receiver drawn from `remaining`,
 * trying candidates in random order and backtracking (trying the next
 * candidate for whichever giver got stuck) whenever a choice turns out to
 * lead nowhere. Returns a completed giver id → receiver id map, or null
 * if this remaining sub-problem has no solution.
 */
const assign = (
	givers: MatchingPerson[],
	remaining: MatchingPerson[],
): Map<number, number> | null => {
	if (givers.length === 0) {
		return new Map();
	}

	const giver = givers[0]!;
	const candidates = shuffled(remaining.filter((receiver) => canGiveTo(giver, receiver)));

	for (const receiver of candidates) {
		const rest = remaining.filter((person) => person.id !== receiver.id);
		const result = assign(givers.slice(1), rest);
		if (result) {
			result.set(giver.id, receiver.id);
			return result;
		}
	}

	return null;
};

/** Fisher-Yates — an unbiased shuffle, unlike repeatedly picking randomly without tracking what's been tried. */
const shuffled = <T>(items: T[]): T[] => {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j]!, result[i]!];
	}
	return result;
};
