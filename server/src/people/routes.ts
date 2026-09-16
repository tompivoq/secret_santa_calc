import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, requireAdmin } from "../auth/middleware.js";
import { AuthVariables } from "../auth/types.js";
import { listPeople, addPerson, removePerson, updatePerson } from "./people.js";
import { z } from "zod";
import type { Db } from "../db/client.js";

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

// Seeing or editing the full list of people — including everyone's
// email, phone, and (at creation time) their plaintext initial password
// — is an admin action, not something every logged-in person gets.
export const getRoutes = (db: Db, authSecret: string) =>
	new Hono<{ Variables: AuthVariables }>()
		.use("*", requireAuth(authSecret), requireAdmin(db))
		.get("/", (c) => c.json(listPeople(db)))
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
