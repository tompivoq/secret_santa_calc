import { Hono } from "hono";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Db } from "./db/client.js";
import { addPerson, listPeople, removePerson, setPartner } from "./people.js";

const newPersonSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.number().int(),
  partnerId: z.number().int().optional().nullable(),
});

const partnerSchema = z.object({
  partnerId: z.number().int().nullable(),
});

/** Builds the Hono app against a given DB instance — a fresh instance per test keeps them isolated. */
export const createApp = (db: Db) => {
  const app = new Hono();

  app.use("*", cors());

  const people = new Hono()
    .get("/", (c) => c.json(listPeople(db)))
    .post("/", zValidator("json", newPersonSchema), (c) => {
      const created = addPerson(db, c.req.valid("json"));
      return c.json(created, 201);
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

  app.route("/api/people", people);

  return app;
};
