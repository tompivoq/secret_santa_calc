import type { Context, Next } from "hono";
import type { Db } from "../db/client.js";
import { listPeople } from "../people/people.js";
import { readSession } from "./session.js";
import { AuthVariables } from "./types.js";

/** Requires a valid session cookie; otherwise responds 401 and short-circuits. Sets `personId` in context for downstream handlers. */
export const requireAuth =
	(authSecret: string) => async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
		const session = await readSession(c, authSecret);
		if (session === null) {
			return c.json({ error: "Not authenticated" }, 401);
		}
		c.set("personId", session.personId);
		c.set("viaMagicLink", session.viaMagicLink);
		await next();
	};

/**
 * Requires the signed-in person to have the admin role. Must run after
 * `requireAuth` (relies on `personId` already being set in context).
 * Guards the people-management API: seeing or editing the full list of
 * people is an admin action, not something every logged-in person gets —
 * see server/src/scripts/set-admin.ts for how someone becomes an admin.
 */
export const requireAdmin =
	(db: Db) => async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
		const person = listPeople(db).find((p) => p.id === c.get("personId"));
		if (!person?.isAdmin) {
			return c.json({ error: "Admin access required" }, 403);
		}
		await next();
	};
