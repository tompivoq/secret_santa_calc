import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, requireAdmin } from "../auth/middleware.js";
import { AuthVariables } from "../auth/types.js";
import { listPeopleWithLoginStatus, addPerson, removePerson, updatePerson } from "./people.js";
import { invitePeople } from "./invite.js";
import { z } from "zod";
import type { Db } from "../db/client.js";
import type { Mailer } from "../mail/mailer.js";

const newPersonSchema = z.object({
	name: z.string().min(1),
	email: z.email(),
	phone: z.int().min(10000000).max(99999999),
	partnerId: z.int().optional().nullable(),
});

/**
 * Every editable field, all optional — one endpoint for the whole edit
 * form, so a change of name and of partner in the same submission either
 * both land or neither does.
 */
const updatePersonSchema = z.object({
	name: z.string().min(1).optional(),
	email: z.email().optional(),
	phone: z.int().min(10000000).max(99999999).optional(),
	partnerId: z.int().nullable().optional(),
	lastYearRecipientId: z.int().nullable().optional(),
});

const UPDATE_ERRORS = {
	"not-found": "No such person",
	"invalid-partner": "That partner doesn't exist, or is the person themselves",
	"invalid-last-year": "That recipient doesn't exist, or is the person themselves",
} as const;

/** A better-sqlite3 error raised by a UNIQUE constraint (e.g. a duplicate email). */
const isUniqueConstraintError = (err: unknown): boolean =>
	err instanceof Error && "code" in err && err.code === "SQLITE_CONSTRAINT_UNIQUE";

const inviteRequestSchema = z.object({
	/**
	 * Who to invite. Omitted means everyone still waiting for an invitation;
	 * naming people sends to exactly those, as a re-send.
	 */
	personIds: z.array(z.int()).min(1).optional(),
});

export interface PeopleOptions {
	mailer: Mailer;
	appBaseUrl: string;
}

// Seeing or editing the full list of people — including everyone's
// email, phone, and (at creation time) their plaintext initial password
// — is an admin action, not something every logged-in person gets.
export const getRoutes = (db: Db, authSecret: string, { mailer, appBaseUrl }: PeopleOptions) =>
	new Hono<{ Variables: AuthVariables }>()
		.use("*", requireAuth(authSecret), requireAdmin(db))
		.get("/", (c) => c.json(listPeopleWithLoginStatus(db)))
		// Needs no draw — inviting people is how they get their password sorted
		// before there is one. 200 even with failures in it, for the same reason
		// as /api/matcher/notify: the admin needs to see who, not one verdict.
		.post("/invite", zValidator("json", inviteRequestSchema), async (c) => {
			const { personIds } = c.req.valid("json");
			return c.json(await invitePeople(db, mailer, authSecret, appBaseUrl, { personIds }));
		})
		.post("/", zValidator("json", newPersonSchema), (c) => {
			try {
				const created = addPerson(db, c.req.valid("json"));
				return c.json(created, 201);
			} catch (err) {
				if (isUniqueConstraintError(err)) {
					return c.json({ error: "Email already in use" }, 409);
				}
				throw err;
			}
		})
		.delete("/:id", (c) => {
			const id = Number(c.req.param("id"));
			if (!Number.isInteger(id)) {
				return c.json({ error: "Invalid id" }, 400);
			}
			removePerson(db, id);
			return c.body(null, 204);
		})
		.patch("/:id", zValidator("json", updatePersonSchema), (c) => {
			const id = Number(c.req.param("id"));
			if (!Number.isInteger(id)) {
				return c.json({ error: "Invalid id" }, 400);
			}

			try {
				const result = updatePerson(db, id, c.req.valid("json"));
				if (!result.ok) {
					return c.json(
						{ error: UPDATE_ERRORS[result.reason] },
						result.reason === "not-found" ? 404 : 400,
					);
				}
				return c.json(result.person);
			} catch (err) {
				if (isUniqueConstraintError(err)) {
					return c.json({ error: "Email already in use" }, 409);
				}
				throw err;
			}
		});
