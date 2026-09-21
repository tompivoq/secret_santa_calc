/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import App from "./App";
import { createStore } from "./store/store";
import type { Person } from "./models/person";
import type { Inbox } from "./store/messagesApi";

const PERSON: Person = {
	id: 1,
	name: "Carl",
	email: "carl@example.com",
	phone: 11223344,
	isAdmin: false,
};

const ANNA = { id: 2, name: "Anna" };
const BJORN = { id: 3, name: "Bjørn" };

/**
 * A signed-in participant whose inbox is stateful: asking and answering
 * change what the next GET returns, the way the real server does.
 */
const stubApi = (initial: Partial<Inbox> = {}) => {
	let inbox: Inbox = { open: true, canAsk: [ANNA, BJORN], sent: [], received: [], ...initial };
	const asked: { recipientId: number; question: string }[] = [];
	const answered: { id: number; answer: string }[] = [];

	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			const url = new URL(request.url);

			if (url.pathname === "/api/auth/me" && request.method === "GET") {
				return new Response(JSON.stringify({ person: PERSON, mustChangePassword: false }), {
					status: 200,
				});
			}

			if (url.pathname === "/api/matcher/mine" && request.method === "GET") {
				return new Response(JSON.stringify({ recipient: ANNA }), { status: 200 });
			}

			if (url.pathname === "/api/messages" && request.method === "GET") {
				return new Response(JSON.stringify(inbox), { status: 200 });
			}

			if (url.pathname === "/api/messages" && request.method === "POST") {
				const body = (await request.json()) as { recipientId: number; question: string };
				asked.push(body);
				const to = inbox.canAsk.find((person) => person.id === body.recipientId)!;
				const message = {
					id: 100 + asked.length,
					to,
					question: body.question,
					askedAt: new Date().toISOString(),
					answer: null,
					answeredAt: null,
				};
				inbox = { ...inbox, sent: [...inbox.sent, message] };
				return new Response(JSON.stringify({ ...message, emailed: true }), { status: 201 });
			}

			const answerMatch = /^\/api\/messages\/(\d+)\/answer$/.exec(url.pathname);
			if (answerMatch && request.method === "POST") {
				const id = Number(answerMatch[1]);
				const { answer } = (await request.json()) as { answer: string };
				answered.push({ id, answer });
				inbox = {
					...inbox,
					received: inbox.received.map((message) =>
						message.id === id
							? { ...message, answer, answeredAt: new Date().toISOString() }
							: message,
					),
				};
				return new Response(JSON.stringify({ emailed: true }), { status: 200 });
			}

			return new Response(null, { status: 204 });
		}),
	);

	return { asked, answered };
};

afterEach(() => {
	vi.unstubAllGlobals();
	// See the identical comment in Auth.integration.test.tsx.
	cleanup();
});

const renderAccountPage = () => {
	window.history.pushState({}, "", "/account");
	return render(
		<Provider store={createStore()}>
			<App />
		</Provider>,
	);
};

const messagesSection = async () => within(await screen.findByRole("region", { name: "Beskeder" }));

describe("anonymous messages", () => {
	it("isn't shown before the draw is locked in", async () => {
		stubApi({ open: false, canAsk: [] });
		renderAccountPage();

		await screen.findByText("Du skal give en gave til:");
		expect(screen.queryByRole("region", { name: "Beskeder" })).toBeNull();
	});

	it("asks the recipient's partner, and shows the question as sent", async () => {
		const { asked } = stubApi();
		const user = userEvent.setup();
		renderAccountPage();

		const section = await messagesSection();
		await user.selectOptions(section.getByLabelText("Til"), "Bjørn");
		await user.type(section.getByLabelText("Spørgsmål"), "Er I hjemme d. 12. december?");
		await user.click(section.getByRole("button", { name: "Send spørgsmål" }));

		expect(await section.findByText("Spørgsmålet er sendt.")).not.toBeNull();
		expect(asked).toEqual([{ recipientId: BJORN.id, question: "Er I hjemme d. 12. december?" }]);
		expect(await section.findByText("Er I hjemme d. 12. december?")).not.toBeNull();
		expect(section.getByText(/^Til Bjørn/)).not.toBeNull();
		expect(section.getByText("Venter på svar")).not.toBeNull();
	});

	it("names the only person to ask when the recipient has no partner", async () => {
		stubApi({ canAsk: [ANNA] });
		renderAccountPage();

		const section = await messagesSection();
		expect(section.queryByLabelText("Til")).toBeNull();
		expect(section.getByLabelText("Spørgsmål til Anna")).not.toBeNull();
	});

	it("shows a received question anonymously, and answers it once", async () => {
		const { answered } = stubApi({
			received: [
				{
					id: 7,
					question: "Hvad er din skostørrelse?",
					askedAt: "2026-11-01T10:00:00.000Z",
					answer: null,
					answeredAt: null,
				},
			],
		});
		const user = userEvent.setup();
		renderAccountPage();

		const section = await messagesSection();
		expect(section.getByText(/^Anonymt spørgsmål/)).not.toBeNull();

		// The answer box stays out of the way until asked for, and can be put away again.
		expect(section.queryByLabelText("Dit svar")).toBeNull();
		await user.click(section.getByRole("button", { name: "Skriv svar" }));
		await user.click(section.getByRole("button", { name: "Annuller" }));
		expect(section.queryByLabelText("Dit svar")).toBeNull();

		await user.click(section.getByRole("button", { name: "Skriv svar" }));
		await user.type(section.getByLabelText("Dit svar"), "43");
		await user.click(section.getByRole("button", { name: "Send svar" }));

		await waitFor(() => expect(answered).toEqual([{ id: 7, answer: "43" }]));
		expect(await section.findByText("43")).not.toBeNull();
		// Answered, so there's nothing left to fill in.
		expect(section.queryByLabelText("Dit svar")).toBeNull();
	});

	it("shows an answer to a question you asked", async () => {
		stubApi({
			sent: [
				{
					id: 5,
					to: ANNA,
					question: "Er du fri d. 12.?",
					askedAt: "2026-11-01T10:00:00.000Z",
					answer: "Ja, hele dagen",
					answeredAt: "2026-11-02T10:00:00.000Z",
				},
			],
		});
		renderAccountPage();

		const section = await messagesSection();
		expect(section.getByText("Ja, hele dagen")).not.toBeNull();
		expect(section.queryByText("Venter på svar")).toBeNull();
	});
});
