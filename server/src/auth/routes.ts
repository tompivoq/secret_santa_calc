import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { Hono } from "hono";
import { listPeople } from "../people/people.js";
import { requireAuth } from "./middleware.js";
import type { AuthVariables } from "./types.js";
import { login, getMustChangePassword, changePassword } from "./service.js";
import { createSession, clearSession } from "./session.js";
import { consumeMagicToken } from "./magic.js";

const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
});

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8),
});

export const getRoutes = (db: Db, authSecret: string) =>
	new Hono<{ Variables: AuthVariables }>()
		.post("/login", zValidator("json", loginSchema), async (c) => {
			const { email, password } = c.req.valid("json");
			const result = login(db, email, password);
			if (!result) {
				return c.json({ error: "Invalid email or password" }, 401);
			}
			await createSession(c, result.person.id, authSecret);
			return c.json({ person: result.person, mustChangePassword: result.mustChangePassword });
		})
		.post("/logout", (c) => {
			clearSession(c);
			return c.body(null, 204);
		})
		// Followed straight from an email, so it answers with a redirect into
		// the app rather than JSON — whoever clicks it is looking at a browser,
		// not a fetch() call.
		.get("/magic/:token", async (c) => {
			const personId = await consumeMagicToken(db, c.req.param("token"), authSecret);
			if (personId === null) {
				return c.redirect("/login?error=link-expired", 303);
			}
			await createSession(c, personId, authSecret);
			return c.redirect("/account", 303);
		})
		.get("/me", requireAuth(authSecret), (c) => {
			const personId = c.get("personId");
			const person = listPeople(db).find((p) => p.id === personId);
			if (!person) {
				// The person behind this session was deleted since it was issued.
				clearSession(c);
				return c.json({ error: "Not authenticated" }, 401);
			}
			return c.json({ person, mustChangePassword: getMustChangePassword(db, personId) });
		})
		.post(
			"/change-password",
			requireAuth(authSecret),
			zValidator("json", changePasswordSchema),
			(c) => {
				const { currentPassword, newPassword } = c.req.valid("json");
				const ok = changePassword(db, c.get("personId"), currentPassword, newPassword);
				if (!ok) {
					return c.json({ error: "Current password is incorrect" }, 401);
				}
				return c.body(null, 204);
			},
		);
