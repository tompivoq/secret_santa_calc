import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { AuthVariables } from "../auth/types.js";
import type { Db } from "../db/client.js";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import { getPeopleByIds } from "../people/people.js";
import { doMatching } from "./matching_logic.js";

const matchRequestSchema = z.object({
	personIds: z.array(z.int()).min(1),
});

// Running the match is an admin action, same as the rest of the
// people-management API — see people/routes.ts for the same reasoning.
export const getRoutes = (db: Db, authSecret: string) =>
	new Hono<{ Variables: AuthVariables }>()
		.use("*", requireAuth(authSecret), requireAdmin(db))
		.post("/", zValidator("json", matchRequestSchema), (c) => {
			const { personIds } = c.req.valid("json");
			const people = getPeopleByIds(db, personIds);

			if (people.length !== personIds.length) {
				return c.json({ error: "One or more people not found" }, 400);
			}

			// hasMatch/currentTarget start unset for everyone — there's nowhere
			// else for them to come from yet (no persisted assignments exist).
			const matched = doMatching(
				people.map((person) => ({ ...person, hasMatch: false, currentTarget: null })),
			);
			return c.json(matched);
		});
