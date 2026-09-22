import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { notes } from "../db/schema.js";
import type { NoteDocument } from "./document.js";

export interface Note {
	/** Null until the first save. */
	content: NoteDocument | null;
	/** 0 before the first save; goes up by one with every save after. */
	version: number;
	updatedAt: Date | null;
}

/** This person's note. Only ever their own: nothing here takes anyone else's id from a request. */
export const getNote = (db: Db, personId: number): Note => {
	const row = db.select().from(notes).where(eq(notes.personId, personId)).get();
	if (!row) {
		return { content: null, version: 0, updatedAt: null };
	}
	return {
		// Stored only after passing parseNoteDocument, so this is known-good.
		content: JSON.parse(row.content) as NoteDocument,
		version: row.version,
		updatedAt: row.updatedAt,
	};
};

export type SaveResult =
	| { ok: true; version: number; updatedAt: Date }
	| { ok: false; reason: "conflict"; current: Note };

/**
 * Saves `serialized` as this person's note, provided `baseVersion` is still
 * the latest — i.e. nothing was saved from another tab or device since the
 * editor loaded it. Otherwise refuses and hands back what's there now, so
 * the page can show the conflict rather than overwrite it.
 *
 * Both paths are single conditional statements, so two saves racing each
 * other can't both succeed.
 */
export const saveNote = (
	db: Db,
	personId: number,
	serialized: string,
	baseVersion: number,
): SaveResult => {
	const now = new Date();
	const saved =
		baseVersion === 0
			? db
					.insert(notes)
					.values({ personId, content: serialized, version: 1, updatedAt: now })
					.onConflictDoNothing()
					.returning()
					.get()
			: db
					.update(notes)
					.set({ content: serialized, version: baseVersion + 1, updatedAt: now })
					.where(and(eq(notes.personId, personId), eq(notes.version, baseVersion)))
					.returning()
					.get();

	if (!saved) {
		return { ok: false, reason: "conflict", current: getNote(db, personId) };
	}
	return { ok: true, version: saved.version, updatedAt: saved.updatedAt };
};
