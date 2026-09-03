import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";
import { credentials } from "../db/schema.js";
import { addPerson } from "../people.js";
import { changePassword, login } from "./service.js";

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  migrate(db, { migrationsFolder });
});

const seed = (name: string) =>
  addPerson(db, { name, email: `${name.toLowerCase()}@example.com`, phone: 22334455 });

describe("addPerson", () => {
  it("creates credentials with a generated initial password that must be changed", () => {
    const anna = seed("Anna");

    expect(anna.initialPassword).toBeTypeOf("string");
    expect(anna.initialPassword.length).toBeGreaterThanOrEqual(8);

    const creds = db.select().from(credentials).where(eq(credentials.personId, anna.id)).get();
    expect(creds?.mustChangePassword).toBe(true);
    // The stored value is a hash, not the plaintext password.
    expect(creds?.passwordHash).not.toContain(anna.initialPassword);
  });

  it("generates a different initial password for each person", () => {
    const anna = seed("Anna");
    const bjorn = seed("Bjørn");
    expect(anna.initialPassword).not.toBe(bjorn.initialPassword);
  });

  it("rejects a duplicate email", () => {
    seed("Anna");
    expect(() =>
      addPerson(db, { name: "Anna Again", email: "anna@example.com", phone: 1 }),
    ).toThrow();
  });
});

describe("login", () => {
  it("succeeds with the correct initial password and reports mustChangePassword", () => {
    const anna = seed("Anna");

    const result = login(db, "anna@example.com", anna.initialPassword);

    expect(result?.person.id).toBe(anna.id);
    expect(result?.mustChangePassword).toBe(true);
  });

  it("fails with the wrong password", () => {
    seed("Anna");
    expect(login(db, "anna@example.com", "not the password")).toBeNull();
  });

  it("fails for an email that doesn't exist", () => {
    expect(login(db, "nobody@example.com", "whatever")).toBeNull();
  });
});

describe("changePassword", () => {
  it("updates the password and clears mustChangePassword", () => {
    const anna = seed("Anna");

    const ok = changePassword(db, anna.id, anna.initialPassword, "a-brand-new-password");

    expect(ok).toBe(true);
    expect(login(db, "anna@example.com", "a-brand-new-password")?.mustChangePassword).toBe(false);
    expect(login(db, "anna@example.com", anna.initialPassword)).toBeNull();
  });

  it("fails, and leaves the password unchanged, when currentPassword is wrong", () => {
    const anna = seed("Anna");

    const ok = changePassword(db, anna.id, "wrong current password", "a-brand-new-password");

    expect(ok).toBe(false);
    expect(login(db, "anna@example.com", anna.initialPassword)).not.toBeNull();
  });

  it("fails for a person with no credentials", () => {
    expect(changePassword(db, 999, "whatever", "a-brand-new-password")).toBe(false);
  });
});
