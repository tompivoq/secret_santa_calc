import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { createApp } from "../app.js";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";
import { credentials, people } from "../db/schema.js";
import { consumeMagicToken } from "../auth/magic.js";
import type { MailMessage, Mailer } from "../mail/mailer.js";
import { addPerson, listPeople, type CreatedPerson } from "./people.js";
import { invitePeople } from "./invite.js";

const SECRET = "test-secret";
const BASE_URL = "https://julenissen.example.com";

let db: Db;

beforeEach(() => {
	db = createDb(":memory:");
	migrate(db, { migrationsFolder });
});

const seed = (name: string): CreatedPerson =>
	addPerson(db, { name, email: `${name.toLowerCase()}@example.com`, phone: 22334455 });

/** As if they'd logged in and replaced their initial password. */
const markPasswordChosen = (personId: number) =>
	db
		.update(credentials)
		.set({ mustChangePassword: false })
		.where(eq(credentials.personId, personId))
		.run();

const invitedAtOf = (personId: number) => listPeople(db).find((p) => p.id === personId)!.invitedAt;

/** Collects what would have been sent, and can be told to fail for one address. */
const fakeMailer = (failFor: string[] = []) => {
	const sent: MailMessage[] = [];
	const mailer: Mailer = {
		send(message) {
			if (failFor.includes(message.to)) {
				return Promise.reject(new Error("Domain is not verified"));
			}
			sent.push(message);
			return Promise.resolve();
		},
	};
	return { mailer, sent };
};

describe("inviting people", () => {
	it("invites everyone who hasn't been, with no draw needed", async () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		const { mailer, sent } = fakeMailer();

		const result = await invitePeople(db, mailer, SECRET, BASE_URL);

		expect(result.failed).toEqual([]);
		expect(result.invited.map((p) => p.personId).sort()).toEqual([anna.id, bjorn.id].sort());
		expect(sent.map((m) => m.to).sort()).toEqual([anna.email, bjorn.email].sort());
		expect(invitedAtOf(anna.id)).toBeInstanceOf(Date);
	});

	it("sends a link that actually logs that person in", async () => {
		const anna = seed("Anna");
		const { mailer, sent } = fakeMailer();

		await invitePeople(db, mailer, SECRET, BASE_URL);

		const link = /https:\/\/\S+/.exec(sent[0]!.text)![0];
		expect(link.startsWith(`${BASE_URL}/api/auth/magic/`)).toBe(true);
		const token = link.slice(`${BASE_URL}/api/auth/magic/`.length);
		expect(await consumeMagicToken(db, token, SECRET)).toBe(anna.id);
	});

	it("skips anyone already invited", async () => {
		seed("Anna");
		await invitePeople(db, fakeMailer().mailer, SECRET, BASE_URL);

		const { mailer, sent } = fakeMailer();
		const result = await invitePeople(db, mailer, SECRET, BASE_URL);

		expect(sent).toEqual([]);
		expect(result.invited).toEqual([]);
	});

	it("skips anyone who has already chosen their own password", async () => {
		// The admin clicking the button, for one — they're plainly in already.
		const admin = seed("Admin");
		markPasswordChosen(admin.id);
		const anna = seed("Anna");
		const { mailer, sent } = fakeMailer();

		await invitePeople(db, mailer, SECRET, BASE_URL);

		expect(sent.map((m) => m.to)).toEqual([anna.email]);
		expect(invitedAtOf(admin.id)).toBeNull();
	});

	it("sends to named people regardless of whether they've had one", async () => {
		const anna = seed("Anna");
		seed("Bjørn");
		await invitePeople(db, fakeMailer().mailer, SECRET, BASE_URL);
		markPasswordChosen(anna.id);

		const { mailer, sent } = fakeMailer();
		const result = await invitePeople(db, mailer, SECRET, BASE_URL, { personIds: [anna.id] });

		expect(result.invited.map((p) => p.personId)).toEqual([anna.id]);
		expect(sent.map((m) => m.to)).toEqual([anna.email]);
	});

	it("reports a failed address, and leaves them waiting so a retry picks them up", async () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");

		const first = await invitePeople(db, fakeMailer([bjorn.email]).mailer, SECRET, BASE_URL);

		expect(first.invited.map((p) => p.personId)).toEqual([anna.id]);
		expect(first.failed).toEqual([
			{ personId: bjorn.id, name: "Bjørn", error: "Domain is not verified" },
		]);
		expect(invitedAtOf(bjorn.id)).toBeNull();

		const retry = await invitePeople(db, fakeMailer().mailer, SECRET, BASE_URL);
		expect(retry.invited.map((p) => p.personId)).toEqual([bjorn.id]);
	});
});

describe("the invitation API", () => {
	const loginAs = async (app: ReturnType<typeof createApp>, email: string, password: string) => {
		const res = await app.request("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		return res.headers.get("set-cookie")!.split(";")[0]!;
	};

	const asAdmin = async (app: ReturnType<typeof createApp>) => {
		const admin = seed("Admin");
		db.update(people).set({ isAdmin: true }).where(eq(people.id, admin.id)).run();
		const cookie = await loginAs(app, "admin@example.com", admin.initialPassword);
		// Standing in for them having set their own, as a real admin would have.
		markPasswordChosen(admin.id);
		return { admin, cookie };
	};

	const postInvite = (app: ReturnType<typeof createApp>, cookie?: string, personIds?: number[]) =>
		app.request("/api/people/invite", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
			body: JSON.stringify(personIds ? { personIds } : {}),
		});

	it("invites everyone waiting and reports who got one", async () => {
		const { mailer, sent } = fakeMailer();
		const app = createApp(db, SECRET, { mailer, appBaseUrl: BASE_URL });
		const { cookie } = await asAdmin(app);
		seed("Anna");
		seed("Bjørn");

		const res = await postInvite(app, cookie);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { invited: { name: string }[]; failed: unknown[] };
		expect(body.invited.map((p) => p.name).sort()).toEqual(["Anna", "Bjørn"]);
		expect(body.failed).toEqual([]);
		expect(sent).toHaveLength(2);
	});

	it("lists who has been invited and who has got in", async () => {
		const app = createApp(db, SECRET, { mailer: fakeMailer().mailer, appBaseUrl: BASE_URL });
		const { admin, cookie } = await asAdmin(app);
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		await postInvite(app, cookie, [anna.id]);

		const listed = (await (await app.request("/api/people", { headers: { cookie } })).json()) as {
			id: number;
			invitedAt: string | null;
			hasChosenPassword: boolean;
		}[];
		const byId = new Map(listed.map((p) => [p.id, p]));

		expect(byId.get(admin.id)!.hasChosenPassword).toBe(true);
		expect(byId.get(anna.id)!.invitedAt).not.toBeNull();
		expect(byId.get(anna.id)!.hasChosenPassword).toBe(false);
		expect(byId.get(bjorn.id)!.invitedAt).toBeNull();
	});

	it("is admin-only", async () => {
		const app = createApp(db, SECRET, { mailer: fakeMailer().mailer, appBaseUrl: BASE_URL });
		const anna = seed("Anna");
		const cookie = await loginAs(app, "anna@example.com", anna.initialPassword);

		expect((await postInvite(app)).status).toBe(401);
		expect((await postInvite(app, cookie)).status).toBe(403);
	});
});
