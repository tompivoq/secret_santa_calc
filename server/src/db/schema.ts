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
