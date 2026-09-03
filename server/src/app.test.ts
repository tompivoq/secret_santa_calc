import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createApp } from "./app.js";
import { createDb, type Db } from "./db/client.js";
import { migrationsFolder } from "./db/migrate.js";
import { addPerson, type CreatedPerson } from "./people.js";

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = createDb(":memory:");
  migrate(db, { migrationsFolder });
  app = createApp(db, "test-secret");
});

/** Extracts the `session=...` cookie pair (dropping attributes like Path/HttpOnly) from a Set-Cookie header. */
const sessionCookieFrom = (res: Response): string => {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Response did not set a cookie");
  }
  return setCookie.split(";")[0]!;
};

const seed = (name: string): CreatedPerson =>
  addPerson(db, { name, email: `${name.toLowerCase()}@example.com`, phone: 22334455 });

interface LoginResponseBody {
  person: { id: number };
  mustChangePassword: boolean;
}

interface MeResponseBody {
  person: { id: number };
}

const asLoginBody = async (res: Response) => (await res.json()) as LoginResponseBody;
const asMeBody = async (res: Response) => (await res.json()) as MeResponseBody;

describe("POST /api/auth/login", () => {
  it("sets a session cookie and reports mustChangePassword on success", async () => {
    const anna = seed("Anna");

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anna@example.com", password: anna.initialPassword }),
    });

    expect(res.status).toBe(200);
    expect(sessionCookieFrom(res)).toMatch(/^session=/);
    const body = await asLoginBody(res);
    expect(body.mustChangePassword).toBe(true);
    expect(body.person.id).toBe(anna.id);
  });

  it("returns 401 for the wrong password, and sets no cookie", async () => {
    seed("Anna");

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anna@example.com", password: "wrong" }),
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await app.request("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the logged-in person given a valid session cookie", async () => {
    const anna = seed("Anna");
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anna@example.com", password: anna.initialPassword }),
    });
    const cookie = sessionCookieFrom(loginRes);

    const res = await app.request("/api/auth/me", { headers: { cookie } });

    expect(res.status).toBe(200);
    const body = await asMeBody(res);
    expect(body.person.id).toBe(anna.id);
  });
});

describe("POST /api/auth/change-password", () => {
  const loginAs = async (email: string, password: string) => {
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return sessionCookieFrom(res);
  };

  it("changes the password and clears mustChangePassword", async () => {
    const anna = seed("Anna");
    const cookie = await loginAs("anna@example.com", anna.initialPassword);

    const res = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        currentPassword: anna.initialPassword,
        newPassword: "a-new-password",
      }),
    });
    expect(res.status).toBe(204);

    const meRes = await app.request("/api/auth/me", { headers: { cookie } });
    expect(meRes.status).toBe(200);

    const secondLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anna@example.com", password: "a-new-password" }),
    });
    expect((await asLoginBody(secondLogin)).mustChangePassword).toBe(false);
  });

  it("returns 401 without a session, and 401 for the wrong current password", async () => {
    const anna = seed("Anna");

    const unauthed = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "x", newPassword: "a-new-password" }),
    });
    expect(unauthed.status).toBe(401);

    const cookie = await loginAs("anna@example.com", anna.initialPassword);
    const wrongCurrent = await app.request("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ currentPassword: "wrong", newPassword: "a-new-password" }),
    });
    expect(wrongCurrent.status).toBe(401);
  });
});

describe("POST /api/people", () => {
  it("rejects a duplicate email with 409", async () => {
    seed("Anna");

    const res = await app.request("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Anna Again", email: "anna@example.com", phone: 1 }),
    });

    expect(res.status).toBe(409);
  });
});
