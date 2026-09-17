import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { createApp } from "../app.js";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";
import { credentials, people } from "../db/schema.js";
import { addPerson, type CreatedPerson } from "../people/people.js";
import { consumeMagicToken, issueMagicToken } from "../auth/magic.js";
import type { MailMessage, Mailer } from "../mail/mailer.js";
import { lockDraft, saveDraft } from "./draws.js";
import { countUnnotified, notifyParticipants } from "./notify.js";

const SECRET = "test-secret";
const BASE_URL = "https://example.com/julenissen";

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

const lockATrio = () => {
	const anna = seed("Anna");
	const bjorn = seed("Bjørn");
	const carl = seed("Carl");
	saveDraft(
		db,
		new Map([
			[anna.id, bjorn.id],
			[bjorn.id, carl.id],
			[carl.id, anna.id],
		]),
	);
	lockDraft(db);
	return { anna, bjorn, carl };
};

describe("notifying participants", () => {
	it("emails everyone in the locked draw a link", async () => {
		const { anna, bjorn, carl } = lockATrio();
		const { mailer, sent } = fakeMailer();

		const result = (await notifyParticipants(db, mailer, SECRET, BASE_URL))!;

		expect(result.failed).toEqual([]);
		expect(result.notified.map((n) => n.personId).sort()).toEqual(
			[anna.id, bjorn.id, carl.id].sort(),
		);
		expect(sent.map((m) => m.to).sort()).toEqual([anna.email, bjorn.email, carl.email].sort());
	});

	it("sends a link that actually logs that person in", async () => {
		const { anna } = lockATrio();
		const { mailer, sent } = fakeMailer();

		await notifyParticipants(db, mailer, SECRET, BASE_URL, { personIds: [anna.id] });

		const link = /https:\/\/\S+/.exec(sent[0]!.text)![0];
		expect(link.startsWith(`${BASE_URL}/api/auth/magic/`)).toBe(true);
		const token = link.slice(`${BASE_URL}/api/auth/magic/`.length);
		expect(await consumeMagicToken(db, token, SECRET)).toBe(anna.id);
	});

	it("links someone who has already chosen a password to their account page instead", async () => {
		const { anna, bjorn } = lockATrio();
		// Anna got in through her invitation; Bjørn never did.
		const invitationToken = await issueMagicToken(db, anna.id, SECRET);
		markPasswordChosen(anna.id);
		const { mailer, sent } = fakeMailer();

		await notifyParticipants(db, mailer, SECRET, BASE_URL, { personIds: [anna.id, bjorn.id] });

		const linkIn = (email: string) =>
			/https:\/\/\S+/.exec(sent.find((m) => m.to === email)!.text)![0];
		expect(linkIn(anna.email)).toBe(`${BASE_URL}/account`);
		expect(sent.find((m) => m.to === anna.email)!.html).toContain(`href="${BASE_URL}/account"`);
		expect(linkIn(bjorn.email).startsWith(`${BASE_URL}/api/auth/magic/`)).toBe(true);
		// No link was minted for Anna, so none of hers was invalidated either.
		expect(await consumeMagicToken(db, invitationToken!, SECRET)).toBe(anna.id);
	});

	it("still counts a plain account-page link as notified", async () => {
		const { anna } = lockATrio();
		markPasswordChosen(anna.id);

		const result = (await notifyParticipants(db, fakeMailer().mailer, SECRET, BASE_URL, {
			personIds: [anna.id],
		}))!;

		expect(result.notified.map((n) => n.personId)).toEqual([anna.id]);
		expect(countUnnotified(db)).toBe(2);
	});

	it("never names the recipient — that's what the link is for", async () => {
		const { anna, bjorn } = lockATrio();
		const { mailer, sent } = fakeMailer();

		await notifyParticipants(db, mailer, SECRET, BASE_URL, { personIds: [anna.id] });

		// Anna draws Bjørn. Putting that in the email would leave the match
		// sitting in her inbox in plaintext indefinitely.
		const email = sent[0]!;
		expect(email.text).toContain("Anna");
		expect(email.text).not.toContain("Bjørn");
		expect(email.html).not.toContain("Bjørn");
		expect(bjorn.name).toBe("Bjørn");
	});

	it("skips people who have already been told", async () => {
		lockATrio();
		const first = fakeMailer();
		await notifyParticipants(db, first.mailer, SECRET, BASE_URL);

		const second = fakeMailer();
		const result = (await notifyParticipants(db, second.mailer, SECRET, BASE_URL))!;

		expect(second.sent).toEqual([]);
		expect(result.notified).toEqual([]);
		expect(countUnnotified(db)).toBe(0);
	});

	it("re-sends to named people even though they've had one", async () => {
		const { anna } = lockATrio();
		await notifyParticipants(db, fakeMailer().mailer, SECRET, BASE_URL);

		const { mailer, sent } = fakeMailer();
		const result = (await notifyParticipants(db, mailer, SECRET, BASE_URL, {
			personIds: [anna.id],
		}))!;

		expect(result.notified.map((n) => n.personId)).toEqual([anna.id]);
		expect(sent.map((m) => m.to)).toEqual([anna.email]);
	});

	it("reports a failed address per person, and still emails everyone else", async () => {
		const { anna, bjorn, carl } = lockATrio();
		const { mailer, sent } = fakeMailer([bjorn.email]);

		const result = (await notifyParticipants(db, mailer, SECRET, BASE_URL))!;

		// One bad address doesn't decide the rest of the family's fate...
		expect(sent.map((m) => m.to).sort()).toEqual([anna.email, carl.email].sort());
		expect(result.notified.map((n) => n.personId).sort()).toEqual([anna.id, carl.id].sort());
		// ...and the admin is told exactly who missed out, and why.
		expect(result.failed).toEqual([
			{ personId: bjorn.id, name: "Bjørn", error: "Domain is not verified" },
		]);
	});

	it("leaves a failed send un-notified, so a retry picks it up", async () => {
		const { bjorn } = lockATrio();
		await notifyParticipants(db, fakeMailer([bjorn.email]).mailer, SECRET, BASE_URL);

		// Marking before sending would have buried him permanently.
		expect(countUnnotified(db)).toBe(1);

		const retry = fakeMailer();
		const result = (await notifyParticipants(db, retry.mailer, SECRET, BASE_URL))!;
		expect(result.notified.map((n) => n.personId)).toEqual([bjorn.id]);
	});

	it("refuses when nothing is locked in", async () => {
		const anna = seed("Anna");
		const bjorn = seed("Bjørn");
		saveDraft(
			db,
			new Map([
				[anna.id, bjorn.id],
				[bjorn.id, anna.id],
			]),
		);

		// A draft is still free to change — telling anyone about one would be
		// telling them something that may never happen.
		expect(await notifyParticipants(db, fakeMailer().mailer, SECRET, BASE_URL)).toBeNull();
	});

	it("treats everyone as un-notified again after a re-draw", async () => {
		const { anna, bjorn, carl } = lockATrio();
		await notifyParticipants(db, fakeMailer().mailer, SECRET, BASE_URL);
		expect(countUnnotified(db)).toBe(0);

		saveDraft(
			db,
			new Map([
				[anna.id, carl.id],
				[carl.id, bjorn.id],
				[bjorn.id, anna.id],
			]),
		);
		lockDraft(db);

		// Their matches changed, so they all need telling again.
		expect(countUnnotified(db)).toBe(3);
	});
});

describe("POST /api/matcher/notify", () => {
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
		return loginAs(app, "admin@example.com", admin.initialPassword);
	};

	const postNotify = (app: ReturnType<typeof createApp>, cookie?: string, personIds?: number[]) =>
		app.request("/api/matcher/notify", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...(cookie && { cookie }) },
			body: JSON.stringify(personIds ? { personIds } : {}),
		});

	it("emails everyone in the locked draw and reports who got one", async () => {
		const { mailer, sent } = fakeMailer();
		const app = createApp(db, SECRET, { mailer, appBaseUrl: BASE_URL });
		const cookie = await asAdmin(app);
		lockATrio();

		const res = await postNotify(app, cookie);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { notified: { name: string }[]; failed: unknown[] };
		expect(body.notified.map((n) => n.name).sort()).toEqual(["Anna", "Bjørn", "Carl"]);
		expect(body.failed).toEqual([]);
		expect(sent).toHaveLength(3);
	});

	it("shows the admin who has been notified, without revealing the pairings", async () => {
		const { mailer } = fakeMailer();
		const app = createApp(db, SECRET, { mailer, appBaseUrl: BASE_URL });
		const cookie = await asAdmin(app);
		const { anna } = lockATrio();
		await postNotify(app, cookie, [anna.id]);

		const current = (await (
			await app.request("/api/matcher/current", { headers: { cookie } })
		).json()) as { notifiedIds: number[]; assignments?: unknown };

		expect(current.notifiedIds).toEqual([anna.id]);
		// The draw was blind by default, so this told the admin who's been
		// written to and still nothing about who drew whom.
		expect(current.assignments).toBeUndefined();
	});

	it("returns 409 when there's no locked draw to notify about", async () => {
		const app = createApp(db, SECRET, { mailer: fakeMailer().mailer, appBaseUrl: BASE_URL });
		const cookie = await asAdmin(app);

		expect((await postNotify(app, cookie)).status).toBe(409);
	});

	it("is admin-only", async () => {
		const app = createApp(db, SECRET, { mailer: fakeMailer().mailer, appBaseUrl: BASE_URL });
		const anna = seed("Anna");
		const cookie = await loginAs(app, "anna@example.com", anna.initialPassword);

		expect((await postNotify(app)).status).toBe(401);
		expect((await postNotify(app, cookie)).status).toBe(403);
	});
});
