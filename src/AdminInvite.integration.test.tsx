/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import App from "./App";
import { createStore } from "./store/store";
import type { Person } from "./models/person";

const ADMIN: Person = {
	id: 1,
	name: "Admin",
	email: "admin@example.com",
	phone: 0,
	isAdmin: true,
	invitedAt: null,
	hasChosenPassword: true,
};

const ANNA: Person = {
	id: 2,
	name: "Anna",
	email: "anna@example.com",
	phone: 22334455,
	isAdmin: false,
	invitedAt: null,
	hasChosenPassword: false,
};

const BJORN: Person = {
	id: 3,
	name: "Bjørn",
	email: "bjorn@example.com",
	phone: 11223344,
	isAdmin: false,
	invitedAt: null,
	hasChosenPassword: false,
};

/**
 * Stubs a logged-in admin, a people list that remembers who has been
 * invited, and no draw at all — invitations are for before there is one.
 * The server's choice of who "everyone waiting" means is mirrored here, and
 * covered for real by its own suite.
 */
const stubApi = (initialPeople: Person[], options: { failFor?: number[] } = {}) => {
	let people = initialPeople;
	/** Each invite request's body, for asserting on what the page asked for. */
	const invited: { personIds?: number[] }[] = [];

	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			const url = new URL(request.url);

			if (url.pathname === "/api/auth/me" && request.method === "GET") {
				return new Response(JSON.stringify({ person: ADMIN, mustChangePassword: false }), {
					status: 200,
				});
			}

			if (url.pathname === "/api/people" && request.method === "GET") {
				return new Response(JSON.stringify(people), { status: 200 });
			}

			if (url.pathname === "/api/matcher/current" && request.method === "GET") {
				return new Response(JSON.stringify(null), { status: 200 });
			}

			if (url.pathname === "/api/people/invite" && request.method === "POST") {
				const body = (await request.json()) as { personIds?: number[] };
				invited.push(body);

				const targets = body.personIds
					? people.filter((person) => body.personIds!.includes(person.id))
					: people.filter((person) => !person.invitedAt && !person.hasChosenPassword);
				const failed = targets.filter((person) => options.failFor?.includes(person.id));
				const sent = targets.filter((person) => !failed.includes(person));

				const now = new Date().toISOString();
				people = people.map((person) =>
					sent.includes(person) ? { ...person, invitedAt: now } : person,
				);

				return new Response(
					JSON.stringify({
						invited: sent.map((person) => ({ personId: person.id, name: person.name })),
						failed: failed.map((person) => ({
							personId: person.id,
							name: person.name,
							error: "Resend afviste e-mailen (422): Invalid `to` field",
						})),
					}),
					{ status: 200 },
				);
			}

			return new Response(null, { status: 204 });
		}),
	);

	return { invited };
};

afterEach(() => {
	vi.unstubAllGlobals();
	// See the identical comment in Auth.integration.test.tsx.
	cleanup();
});

const renderAdminPage = () =>
	render(
		<Provider store={createStore()}>
			<App />
		</Provider>,
	);

/**
 * The list entry for one person — scoped, since every entry has its own
 * "Inviter" button. Found through its checkbox, because the name alone also
 * matches the nav ("Admin") and the invite panel's lists of names.
 */
const entryFor = async (name: string) =>
	(await screen.findByLabelText(`Inkluder ${name} i næste lodtrækning`)).closest("li")!;

describe("inviting people from the admin page", () => {
	it("invites everyone still waiting, before any draw has been made", async () => {
		const { invited } = stubApi([ADMIN, ANNA, BJORN]);
		const user = userEvent.setup();
		renderAdminPage();

		// The admin is already in, so isn't counted as waiting.
		await user.click(
			await screen.findByRole("button", { name: "Send invitation til de 2 der mangler" }),
		);

		expect(await screen.findByText("Sendte email til Anna, Bjørn.")).not.toBeNull();
		// Nobody named: the server decides who's waiting, not a stale client list.
		expect(invited).toEqual([{}]);
		expect(
			await screen.findByText("Alle er inviteret eller har allerede logget ind."),
		).not.toBeNull();
	});

	it("shows each person's login status", async () => {
		stubApi([ADMIN, ANNA, { ...BJORN, invitedAt: "2026-09-01T10:00:00.000Z" }]);
		renderAdminPage();

		expect(within(await entryFor("Admin")).getByText("Logget ind")).not.toBeNull();
		expect(within(await entryFor("Anna")).getByText("Ikke inviteret")).not.toBeNull();
		expect(within(await entryFor("Bjørn")).getByText(/^Inviteret d\./)).not.toBeNull();
	});

	it("invites a single person from their entry in the list", async () => {
		const { invited } = stubApi([ADMIN, ANNA, BJORN]);
		const user = userEvent.setup();
		renderAdminPage();

		const anna = await entryFor("Anna");
		await user.click(within(anna).getByRole("button", { name: "Inviter" }));

		expect(await within(anna).findByText("Invitation sendt.")).not.toBeNull();
		expect(invited).toEqual([{ personIds: [ANNA.id] }]);
		expect(await within(anna).findByRole("button", { name: "Inviter igen" })).not.toBeNull();
	});

	it("re-sends to those invited who still haven't logged in", async () => {
		const { invited } = stubApi([
			ADMIN,
			{ ...ANNA, invitedAt: "2026-09-01T10:00:00.000Z" },
			{ ...BJORN, invitedAt: "2026-09-01T10:00:00.000Z" },
		]);
		const user = userEvent.setup();
		renderAdminPage();

		await user.click(
			await screen.findByRole("button", {
				name: "Send igen til de 2 der ikke har logget ind",
			}),
		);

		await screen.findByText("Sendte email til Anna, Bjørn.");
		expect(invited).toEqual([{ personIds: [ANNA.id, BJORN.id] }]);
	});

	it("names whoever the email couldn't be sent to, and why", async () => {
		stubApi([ADMIN, ANNA, BJORN], { failFor: [BJORN.id] });
		const user = userEvent.setup();
		renderAdminPage();

		await user.click(
			await screen.findByRole("button", { name: "Send invitation til de 2 der mangler" }),
		);

		expect(await screen.findByText("Sendte email til Anna.")).not.toBeNull();
		expect(
			screen.getByText("Bjørn — Resend afviste e-mailen (422): Invalid `to` field"),
		).not.toBeNull();
		// Still waiting, so the button offers to try again.
		expect(
			await screen.findByRole("button", { name: "Send invitation til de 1 der mangler" }),
		).not.toBeNull();
	});
});
