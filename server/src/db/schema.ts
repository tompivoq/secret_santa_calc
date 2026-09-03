import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: integer("phone").notNull(),
  // Self-referential: the id of this person's partner, if any. Not declared
  // as a DB-level foreign key (SQLite self-references add friction for
  // little benefit at this scale) — reciprocity and validity are enforced
  // in the people service instead.
  partnerId: integer("partner_id"),
});

export type PersonRow = typeof people.$inferSelect;
export type NewPersonRow = typeof people.$inferInsert;
