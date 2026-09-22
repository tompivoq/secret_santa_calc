import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createApp } from "../app.js";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";
import { addPerson, removePerson, type CreatedPerson } from "../people/people.js";
import { MAX_NOTE_LENGTH } from "./document.js";
import { getNote } from "./notes.js";

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
	db = createDb(":memory:");
	migrate(db, { migrationsFolder });
	app = createApp(db, "test-secret");
});

const seed = (name: string): CreatedPerson =>
	addPerson(db, { name, email: `${name.toLowerCase()}@example.com`, phone: 22334455 });

const loginAs = async (person: CreatedPerson) => {
	const res = await app.request("/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: person.email, password: person.initialPassword }),
	});
	return res.headers.get("set-cookie")!.split(";")[0]!;
};

const noteWith = (value: string) => ({
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
});

const load = async (cookie: string) =>
	(await (await app.request("/api/notes", { headers: { cookie } })).json()) as {
		content: unknown;
		version: number;
	};

const save = (cookie: string, content: unknown, baseVersion: number) =>
	app.request("/api/notes", {
		method: "PUT",
		headers: { "Content-Type": "application/json", cookie },
		body: JSON.stringify({ content, baseVersion }),
	});

describe("notes", () => {
	it("starts empty", async () => {
		const cookie = await loginAs(seed("Anna"));

		expect(await load(cookie)).toMatchObject({ content: null, version: 0 });
	});

	it("saves and loads a note, bumping the version each time", async () => {
		const cookie = await loginAs(seed("Anna"));

		const first = await save(cookie, noteWith("Teaterbilletter?"), 0);
		expect(first.status).toBe(200);
		expect(((await first.json()) as { version: number }).version).toBe(1);

		expect((await save(cookie, noteWith("Teaterbilletter!"), 1)).status).toBe(200);
		expect(await load(cookie)).toMatchObject({ content: noteWith("Teaterbilletter!"), version: 2 });
	});

	it("refuses a save made from an out-of-date copy, and returns the newer one", async () => {
		const cookie = await loginAs(seed("Anna"));
		await save(cookie, noteWith("Fra telefonen"), 0);

		// A second device that loaded before the save above still thinks it's at 0.
		const stale = await save(cookie, noteWith("Fra computeren"), 0);
		expect(stale.status).toBe(409);
		const body = (await stale.json()) as { current: { content: unknown; version: number } };
		expect(body.current).toMatchObject({ content: noteWith("Fra telefonen"), version: 1 });
		// And nothing was overwritten.
		expect((await load(cookie)).content).toEqual(noteWith("Fra telefonen"));
	});

	it("keeps everyone's note to themselves", async () => {
		const annaCookie = await loginAs(seed("Anna"));
		const bjornCookie = await loginAs(seed("Bjorn"));
		await save(annaCookie, noteWith("Annas hemmelighed"), 0);

		const bjornsView = await app.request("/api/notes", { headers: { cookie: bjornCookie } });
		expect(await bjornsView.text()).not.toContain("hemmelighed");
		expect((await load(bjornCookie)).version).toBe(0);
	});

	it("refuses a note with a javascript: link, and stores nothing", async () => {
		const anna = seed("Anna");
		const cookie = await loginAs(anna);
		const hostile = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "text",
							text: "klik",
							marks: [{ type: "link", attrs: { href: "javascript:alert(document.cookie)" } }],
						},
					],
				},
			],
		};

		expect((await save(cookie, hostile, 0)).status).toBe(400);
		expect(getNote(db, anna.id).version).toBe(0);
	});

	it("refuses HTML sent in place of a document", async () => {
		const cookie = await loginAs(seed("Anna"));

		expect((await save(cookie, "<img src=x onerror=alert(1)>", 0)).status).toBe(400);
	});

	it("refuses a note over the size cap", async () => {
		const cookie = await loginAs(seed("Anna"));

		const res = await save(cookie, noteWith("x".repeat(MAX_NOTE_LENGTH)), 0);
		expect(res.status).toBe(413);
	});

	it("is deleted along with its owner", async () => {
		const anna = seed("Anna");
		await save(await loginAs(anna), noteWith("Hej"), 0);

		removePerson(db, anna.id);
		expect(getNote(db, anna.id).version).toBe(0);
	});

	it("requires a login", async () => {
		expect((await app.request("/api/notes")).status).toBe(401);
		expect((await save("", noteWith("Hej"), 0)).status).toBe(401);
	});
});
