import { sql, SQL } from "drizzle-orm";
import { sqliteTable, integer, text, uniqueIndex, AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export function lower(email: AnySQLiteColumn): SQL {
	return sql`lower(${email})`;
}

export const people = sqliteTable(
	"people",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		name: text("name").notNull(),
		// Unique because login looks a person up by email — see credentials below.
		email: text("email").notNull().unique(),
		phone: integer("phone").notNull(),
		// Self-referential: the id of this person's partner, if any. Not declared
		// as a DB-level foreign key (SQLite self-references add friction for
		// little benefit at this scale) — reciprocity and validity are enforced
		// in the people service instead.
		partnerId: integer("partner_id"),
		// Gates access to the people-management API (list/create/delete/partner)
		// — see auth/middleware.ts. Not settable through the app itself; granted
		// out-of-band via the set-admin script (server/src/scripts/set-admin.ts).
		isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
	},
	(table) => [uniqueIndex("emailUniqueIndex").on(lower(table.email))],
);

export type PersonRow = typeof people.$inferSelect;
export type NewPersonRow = typeof people.$inferInsert;

// One-to-one with people, keyed by personId rather than its own id — a
// person has at most one set of login credentials. This one *is* a real
// foreign key (with cascade delete, unlike partnerId above): it's an
// owned child record, not a nullable cross-reference, so there's no
// "invalid reference" state for the service layer to guard against —
// SQLite enforces it for free as long as foreign_keys is on (see db/client.ts).
export const credentials = sqliteTable("credentials", {
	personId: integer("person_id")
		.primaryKey()
		.references(() => people.id, { onDelete: "cascade" }),
	passwordHash: text("password_hash").notNull(),
	// True until the person completes their first login and picks their own
	// password; the API refuses everything except change-password until then.
	mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
});

export type CredentialsRow = typeof credentials.$inferSelect;
export type NewCredentialsRow = typeof credentials.$inferInsert;

/**
 * One run of the draw. Starts unlocked (a draft the admin can re-roll as
 * many times as they like) and becomes read-only history once locked in.
 *
 * Drafts are persisted rather than kept in memory so that locking in
 * freezes exactly the assignment the admin looked at and approved —
 * re-running the (randomized) matching at lock time would freeze one they
 * never saw. At most one unlocked draft exists at a time; see draws.ts.
 *
 * No `year` column: "which draw came before this one" is what the
 * repeat-avoidance in matching_logic.ts actually needs, and row order
 * already answers that. A year would only add a second, disagreeable
 * source of truth for the same question.
 */
export const draws = sqliteTable("draws", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	/** Null while this is still a draft. Set once, when the admin locks it in. */
	lockedAt: integer("locked_at", { mode: "timestamp" }),
	/**
	 * Whether the pairings are withheld from the admin too — the usual case
	 * for a real draw, since the admin is normally taking part in it and
	 * seeing everyone's match would spoil their own. Stored rather than
	 * decided per request so it still holds after a reload, and enforced
	 * where it matters: the route strips the assignments out entirely.
	 *
	 * The server itself still reads them, to avoid repeating last year's
	 * pairings — being blind to the admin isn't being blind to everyone.
	 */
	blind: integer("blind", { mode: "boolean" }).notNull().default(true),
});

export type DrawRow = typeof draws.$inferSelect;

/**
 * Who gives to whom within one draw. Cascades from both sides: deleting a
 * person removes the rows they give or receive in, which degrades to
 * "whoever was giving to them is shown as unmatched" rather than leaving a
 * row pointing at someone who no longer exists.
 */
export const assignments = sqliteTable("assignments", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	drawId: integer("draw_id")
		.notNull()
		.references(() => draws.id, { onDelete: "cascade" }),
	giverId: integer("giver_id")
		.notNull()
		.references(() => people.id, { onDelete: "cascade" }),
	recipientId: integer("recipient_id")
		.notNull()
		.references(() => people.id, { onDelete: "cascade" }),
});

export type AssignmentRow = typeof assignments.$inferSelect;
