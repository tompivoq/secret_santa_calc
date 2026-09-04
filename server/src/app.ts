import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Db } from "./db/client.js";
import { addPerson, listPeople, removePerson, setPartner } from "./people.js";
import { changePassword, getMustChangePassword, login } from "./auth/service.js";
import { clearSession, createSession } from "./auth/session.js";
import { requireAdmin, requireAuth, type AuthVariables } from "./auth/middleware.js";

const newPersonSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.number().int(),
  partnerId: z.number().int().optional().nullable(),
});

const partnerSchema = z.object({
  partnerId: z.number().int().nullable(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

/** A better-sqlite3 error raised by a UNIQUE constraint (e.g. a duplicate email). */
const isUniqueConstraintError = (err: unknown): boolean =>
  err instanceof Error && "code" in err && err.code === "SQLITE_CONSTRAINT_UNIQUE";

/** Builds the Hono app against a given DB instance — a fresh instance per test keeps them isolated. */
export const createApp = (db: Db, authSecret: string) => {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.use("*", cors({ origin: (origin) => origin, credentials: true }));

  // Seeing or editing the full list of people — including everyone's
  // email, phone, and (at creation time) their plaintext initial password
  // — is an admin action, not something every logged-in person gets.
  const people = new Hono<{ Variables: AuthVariables }>()
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
    .put("/:id/partner", zValidator("json", partnerSchema), (c) => {
      const id = Number(c.req.param("id"));
      if (!Number.isInteger(id)) {
        return c.json({ error: "Invalid id" }, 400);
      }
      const ok = setPartner(db, id, c.req.valid("json").partnerId);
      if (!ok) {
        return c.json({ error: "No such person, or invalid partner" }, 400);
      }
      return c.body(null, 204);
    });

  const auth = new Hono<{ Variables: AuthVariables }>()
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

  app.route("/api/people", people);
  app.route("/api/auth", auth);

  return app;
};
