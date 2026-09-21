import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createApp } from "../app.js";
import { createDb, type Db } from "../db/client.js";
import { migrationsFolder } from "../db/migrate.js";
import type { MailMessage, Mailer } from "../mail/mailer.js";
import { lockDraft, saveDraft } from "../matcher/draws.js";
import { addPerson, setPartner, type CreatedPerson } from "../people/people.js";
import { MAX_MESSAGE_LENGTH } from "./messages.js";

const SECRET = "test-secret";
const BASE_URL = "https://julenissen.example.com";

let db: Db;
let app: ReturnType<typeof createApp>;
let sent: MailMessage[];

beforeEach(() => {
	db = createDb(":memory:");
	migrate(db, { migrationsFolder });
	sent = [];
	const mailer: Mailer = {
		send(message) {
			sent.push(message);
			return Promise.resolve();
		},
	};
	app = createApp(db, SECRET, { mailer, appBaseUrl: BASE_URL });
});

const seed = (name: string): CreatedPerson =>
	addPerson(db, { name, email: `${name.toLowerCase()}@example.com`, phone: 22334455 });

/**
 * Anna and Bjørn are partners. Carl gives to Anna, Dora to Bjørn — so Anna
 * can be asked by Carl as his recipient, and by Dora as her recipient's
 * partner, and must not be able to tell the two apart.
 */
const setUp = ({ lock = true } = {}) => {
	const anna = seed("Anna");
	const bjorn = seed("Bjorn");
	const carl = seed("Carl");
	const dora = seed("Dora");
	setPartner(db, anna.id, bjorn.id);
	saveDraft(
		db,
		new Map([
			[carl.id, anna.id],
			[anna.id, dora.id],
			[dora.id, bjorn.id],
			[bjorn.id, carl.id],
		]),
	);
	if (lock) {
		lockDraft(db);
	}
	return { anna, bjorn, carl, dora };
};

const loginAs = async (person: CreatedPerson) => {
	const res = await app.request("/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: person.email, password: person.initialPassword }),
	});
	return res.headers.get("set-cookie")!.split(";")[0]!;
};

const getInbox = async (cookie: string) =>
	(await (await app.request("/api/messages", { headers: { cookie } })).json()) as {
		open: boolean;
		canAsk: { id: number; name: string }[];
		sent: { id: number; to: { id: number }; question: string; answer: string | null }[];
		received: Record<string, unknown>[];
	};

const ask = (cookie: string, recipientId: number, question: string) =>
	app.request("/api/messages", {
		method: "POST",
		headers: { "Content-Type": "application/json", cookie },
		body: JSON.stringify({ recipientId, question }),
	});

const answer = (cookie: string, messageId: number, text: string) =>
	app.request(`/api/messages/${messageId}/answer`, {
		method: "POST",
		headers: { "Content-Type": "application/json", cookie },
		body: JSON.stringify({ answer: text }),
	});

describe("asking questions", () => {
	it("is closed until the draw is locked in", async () => {
		const { anna, carl } = setUp({ lock: false });
		const cookie = await loginAs(carl);

		expect((await getInbox(cookie)).open).toBe(false);
		// A draft may still be re-rolled, so Anna may not stay Carl's recipient.
		expect((await ask(cookie, anna.id, "Hvad er din skostørrelse?")).status).toBe(409);
	});

	it("offers the recipient and their partner, and no one else", async () => {
		const { anna, bjorn, carl } = setUp();
		const inbox = await getInbox(await loginAs(carl));

		expect(inbox.open).toBe(true);
		expect(inbox.canAsk.map((p) => p.id).sort()).toEqual([anna.id, bjorn.id].sort());
	});

	it("lets a giver ask their recipient's partner", async () => {
		const { bjorn, carl } = setUp();
		const res = await ask(await loginAs(carl), bjorn.id, "Er I hjemme d. 12. december?");

		expect(res.status).toBe(201);
	});

	it("refuses anyone who is neither the recipient nor their partner", async () => {
		const { carl, dora } = setUp();

		expect((await ask(await loginAs(carl), dora.id, "Hej?")).status).toBe(403);
	});

	it("rejects an empty or overlong question", async () => {
		const { anna, carl } = setUp();
		const cookie = await loginAs(carl);

		expect((await ask(cookie, anna.id, "   ")).status).toBe(400);
		expect((await ask(cookie, anna.id, "x".repeat(MAX_MESSAGE_LENGTH + 1))).status).toBe(400);
	});

	it("shows the sender what they asked, and whom", async () => {
		const { anna, carl } = setUp();
		const cookie = await loginAs(carl);
		await ask(cookie, anna.id, "Hvad er din skostørrelse?");

		const inbox = await getInbox(cookie);
		expect(inbox.sent).toMatchObject([
			{ to: { id: anna.id }, question: "Hvad er din skostørrelse?", answer: null },
		]);
	});

	it("requires a login", async () => {
		expect((await app.request("/api/messages")).status).toBe(401);
	});
});

describe("anonymity", () => {
	it("never tells the recipient who asked, or whether it was about them or their partner", async () => {
		const { anna, carl, dora } = setUp();
		// Carl asks Anna as his recipient; Dora asks her as Bjørn's partner.
		await ask(await loginAs(carl), anna.id, "Spørgsmål fra modtagerens nisse");
		await ask(await loginAs(dora), anna.id, "Spørgsmål fra partnerens nisse");

		const inbox = await getInbox(await loginAs(anna));
		// Only what she was asked: Dora is also Anna's own recipient, so her
		// name rightly appears in who Anna can ask.
		const raw = JSON.stringify(inbox.received);

		expect(inbox.received).toHaveLength(2);
		// Exactly these fields, for both — the two are indistinguishable.
		for (const question of inbox.received) {
			expect(Object.keys(question).sort()).toEqual([
				"answer",
				"answeredAt",
				"askedAt",
				"id",
				"question",
			]);
		}
		// Not smuggled in anywhere else in the response either.
		expect(raw).not.toContain("Carl");
		expect(raw).not.toContain("Dora");
		expect(raw).not.toContain(`"senderId"`);
	});

	it("emails the recipient a notice, without the question or anything about who asked", async () => {
		const { anna, carl } = setUp();
		await ask(await loginAs(carl), anna.id, "Hvad er din skostørrelse?");

		expect(sent.map((m) => m.to)).toEqual([anna.email]);
		const email = sent[0]!;
		for (const body of [email.subject, email.text, email.html]) {
			expect(body).not.toContain("skostørrelse");
			expect(body).not.toContain("Carl");
		}
	});

	it("keeps the answer's response anonymous too", async () => {
		const { anna, carl } = setUp();
		const asked = (await (await ask(await loginAs(carl), anna.id, "Hej?")).json()) as {
			id: number;
		};

		const res = await answer(await loginAs(anna), asked.id, "Hej selv!");
		const raw = await res.text();

		expect(res.status).toBe(200);
		expect(raw).not.toContain("Carl");
		expect(raw).not.toContain(`"senderId"`);
	});
});

describe("answering", () => {
	const askAnna = async () => {
		const people = setUp();
		const carlCookie = await loginAs(people.carl);
		const asked = (await (await ask(carlCookie, people.anna.id, "Er du fri d. 12.?")).json()) as {
			id: number;
		};
		sent.length = 0;
		return { ...people, carlCookie, questionId: asked.id };
	};

	it("shows the answer to the asker, and emails them", async () => {
		const { anna, carl, carlCookie, questionId } = await askAnna();

		expect((await answer(await loginAs(anna), questionId, "Ja, hele dagen")).status).toBe(200);

		const inbox = await getInbox(carlCookie);
		expect(inbox.sent[0]!.answer).toBe("Ja, hele dagen");
		expect(sent.map((m) => m.to)).toEqual([carl.email]);
		expect(sent[0]!.text).not.toContain("Ja, hele dagen");
	});

	it("can only be answered once", async () => {
		const { anna, questionId } = await askAnna();
		const cookie = await loginAs(anna);

		await answer(cookie, questionId, "Ja");
		expect((await answer(cookie, questionId, "Nej, alligevel ikke")).status).toBe(409);
		expect((await getInbox(cookie)).received[0]!.answer).toBe("Ja");
	});

	it("can only be answered by whoever was asked", async () => {
		const { bjorn, dora, questionId } = await askAnna();

		// Not even her partner — and reported as missing, not forbidden.
		expect((await answer(await loginAs(bjorn), questionId, "Ja")).status).toBe(404);
		expect((await answer(await loginAs(dora), questionId, "Ja")).status).toBe(404);
	});

	it("reports an unknown question as not found", async () => {
		const { anna } = await askAnna();

		expect((await answer(await loginAs(anna), 9999, "Ja")).status).toBe(404);
	});
});

describe("after a re-draw", () => {
	it("leaves the old draw's questions behind", async () => {
		const { anna, bjorn, carl, dora, carlCookie, questionId } = await (async () => {
			const people = setUp();
			const carlCookie = await loginAs(people.carl);
			const asked = (await (await ask(carlCookie, people.anna.id, "Hej?")).json()) as {
				id: number;
			};
			return { ...people, carlCookie, questionId: asked.id };
		})();

		saveDraft(
			db,
			new Map([
				[carl.id, dora.id],
				[dora.id, carl.id],
				[anna.id, carl.id],
				[bjorn.id, dora.id],
			]),
		);
		lockDraft(db);

		// About a pairing that no longer holds, so neither side sees it...
		expect((await getInbox(carlCookie)).sent).toEqual([]);
		const annaCookie = await loginAs(anna);
		expect((await getInbox(annaCookie)).received).toEqual([]);
		// ...and it can't be answered either.
		expect((await answer(annaCookie, questionId, "Hej")).status).toBe(404);
	});
});
