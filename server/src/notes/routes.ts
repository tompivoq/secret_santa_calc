import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import type { AuthVariables } from "../auth/types.js";
import type { Db } from "../db/client.js";
import { MAX_NOTE_LENGTH, parseNoteDocument } from "./document.js";
import { getNote, saveNote } from "./notes.js";

const saveSchema = z.object({
	// Checked separately by parseNoteDocument, which knows the rules for it.
	content: z.unknown(),
	baseVersion: z.int().min(0),
});

/**
 * The signed-in person's own notepad, and nothing else: there's no id in
 * any of these paths, so there's no way to ask for someone else's — and
 * no admin view either.
 */
export const getRoutes = (db: Db, authSecret: string) =>
	new Hono<{ Variables: AuthVariables }>()
		.use("*", requireAuth(authSecret))
		.get("/", (c) => c.json(getNote(db, c.get("personId"))))
		.put(
			"/",
			// Refuse an oversized body before parsing it at all. A little
			// headroom over the note itself for the rest of the request.
			bodyLimit({
				maxSize: MAX_NOTE_LENGTH + 1024,
				onError: (c) => c.json({ error: "Note too large" }, 413),
			}),
			zValidator("json", saveSchema),
			(c) => {
				const { content, baseVersion } = c.req.valid("json");
				const parsed = parseNoteDocument(content);
				if (!parsed.ok) {
					return parsed.reason === "too-large"
						? c.json({ error: "Note too large" }, 413)
						: c.json({ error: "Note contains content that isn't allowed" }, 400);
				}

				const result = saveNote(db, c.get("personId"), parsed.serialized, baseVersion);
				if (!result.ok) {
					// The newer version comes back, so the page can offer it.
					return c.json({ error: "Note was changed elsewhere", current: result.current }, 409);
				}
				return c.json({ version: result.version, updatedAt: result.updatedAt });
			},
		);
