import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { AuthVariables } from "../auth/types.js";
import type { Db } from "../db/client.js";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import { getPeopleByIds } from "../people/people.js";
import { doMatching, type MatchingPerson } from "./matching_logic.js";
import {
	asPairs,
	getCurrentDraw,
	getLatestLockedDraw,
	hasDraft,
	hasLockedDraw,
	lockDraft,
	saveDraft,
	type Draw,
} from "./draws.js";

const draftRequestSchema = z.object({
	personIds: z.array(z.int()).min(1),
	/**
	 * Required to start a new draw once one is locked in. Without it an
	 * accidental click would quietly re-draw a result people may already
	 * have been told about. Re-rolling a draft that's already in progress
	 * doesn't need it — nothing has been committed to yet.
	 */
	startOver: z.boolean().optional(),
});

interface DraftResult {
	draw: Draw;
	/** True when last year's pairings had to be allowed to find any valid match at all. */
	repeatedLastYear: boolean;
}

/**
 * Runs the matching for `people` and stores the result as the draft.
 * Tries to avoid last year's pairings first, then falls back to allowing
 * them rather than telling the admin a perfectly matchable group is
 * impossible — reporting *that* it fell back is the honest middle ground.
 */
const runDraft = (db: Db, people: MatchingPerson[]): DraftResult | null => {
	const previous = getLatestLockedDraw(db);
	const withoutRepeats = previous ? doMatching(people, asPairs(previous)) : null;
	const matched = withoutRepeats ?? doMatching(people);
	if (!matched) {
		return null;
	}

	const pairs = new Map(matched.map((person) => [person.id, person.currentTarget!]));
	return {
		draw: saveDraft(db, pairs),
		repeatedLastYear: previous !== null && withoutRepeats === null,
	};
};

// Running and locking in the draw is an admin action, same as the rest of
// the people-management API — see people/routes.ts for the same reasoning.
// requireAdmin is applied per-route rather than to "*" so that routes every
// signed-in person may reach can sit alongside these later.
export const getRoutes = (db: Db, authSecret: string) =>
	new Hono<{ Variables: AuthVariables }>()
		.use("*", requireAuth(authSecret))
		.get("/current", requireAdmin(db), (c) => c.json(getCurrentDraw(db)))
		.post("/draft", requireAdmin(db), zValidator("json", draftRequestSchema), (c) => {
			const { personIds, startOver } = c.req.valid("json");

			const rows = getPeopleByIds(db, personIds);
			if (rows.length !== personIds.length) {
				return c.json({ error: "One or more people not found" }, 400);
			}
			// Only a *new* draw needs confirming. With a draft already in
			// progress, this is just another re-roll of something uncommitted.
			if (!hasDraft(db) && hasLockedDraw(db) && startOver !== true) {
				return c.json({ error: "The draw is already locked in. Start over to draw again." }, 409);
			}

			// hasMatch/currentTarget start unset for everyone — a previous draw's
			// assignments are last year's, and are handled as exclusions instead.
			const people = rows.map((person) => ({
				...person,
				hasMatch: false,
				currentTarget: null,
			}));

			const result = runDraft(db, people);
			if (!result) {
				return c.json({ error: "No valid matching exists for this group" }, 422);
			}
			return c.json(result);
		})
		.post("/lock", requireAdmin(db), (c) => {
			const locked = lockDraft(db);
			if (!locked) {
				return c.json({ error: "There is no draft to lock in" }, 409);
			}
			return c.json(locked);
		});
