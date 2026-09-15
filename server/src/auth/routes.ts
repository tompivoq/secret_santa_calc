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
	/** Omitted only by someone setting their first password from a magic-link session. */
	currentPassword: z.string().min(1).optional(),
	newPassword: z.string().min(8),
});

/**
 * Whether this session may set a password without producing the current
 * one: they followed an emailed link, and have never chosen a password of
 * their own. Possession of the link proves control of the address, which
 * is the same standard a password reset works to — and the exception stops
 * applying the moment they have a password worth protecting.
 */
const maySkipCurrentPassword = (db: Db, personId: number, viaMagicLink: boolean): boolean =>
	viaMagicLink && getMustChangePassword(db, personId);

/**
 * `appBaseUrl` prefixes the post-link redirects. Empty (the default in
 * tests) leaves them root-relative, which is right when the app is served
 * from the root of its own host; under a path prefix it's what keeps
 * "/account" from meaning the wrong thing.
 */
export const getRoutes = (db: Db, authSecret: string, appBaseUrl = "") =>
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
				return c.redirect(`${appBaseUrl}/login?error=link-expired`, 303);
			}
			// Flagged as link-originated, so the forced password change this
			// person is about to be sent to can actually be completed.
			await createSession(c, personId, authSecret, { viaMagicLink: true });
			return c.redirect(`${appBaseUrl}/account`, 303);
		})
		.get("/me", requireAuth(authSecret), (c) => {
			const personId = c.get("personId");
			const person = listPeople(db).find((p) => p.id === personId);
			if (!person) {
				// The person behind this session was deleted since it was issued.
				clearSession(c);
				return c.json({ error: "Not authenticated" }, 401);
			}
			return c.json({
				person,
				mustChangePassword: getMustChangePassword(db, personId),
				// Lets the form know whether to ask for the current password at
				// all, rather than showing a field this person can't fill in.
				requiresCurrentPassword: !maySkipCurrentPassword(db, personId, c.get("viaMagicLink")),
			});
		})
		.post(
			"/change-password",
			requireAuth(authSecret),
			zValidator("json", changePasswordSchema),
			(c) => {
				const { currentPassword, newPassword } = c.req.valid("json");
				const personId = c.get("personId");
				const ok = changePassword(db, personId, currentPassword ?? null, newPassword, {
					allowWithoutCurrent: maySkipCurrentPassword(db, personId, c.get("viaMagicLink")),
				});
				if (!ok) {
					return c.json({ error: "Current password is incorrect" }, 401);
				}
				return c.body(null, 204);
			},
		);
