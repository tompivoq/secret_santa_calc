import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";
import { listPeople } from "../people.js";
import { login } from "../auth/service.js";
import { DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, seedDevAdmin } from "./seedAdmin.js";

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  migrate(db, { migrationsFolder });
});

describe("seedDevAdmin", () => {
  it("creates an admin that can log in with the fixed password, with nothing pending", () => {
    seedDevAdmin(db);

    const result = login(db, DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD);

    expect(result?.person.isAdmin).toBe(true);
    expect(result?.mustChangePassword).toBe(false);
  });

  it("is idempotent — running it again doesn't create a second account or change the password", () => {
    seedDevAdmin(db);
    seedDevAdmin(db);

    expect(listPeople(db).filter((p) => p.email === DEV_ADMIN_EMAIL)).toHaveLength(1);
    expect(login(db, DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD)).not.toBeNull();
  });
});
