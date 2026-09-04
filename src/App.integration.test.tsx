/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import App from "./App";
import { createStore } from "./store/store";
import type { Person } from "./models/person";

const renderApp = () =>
	render(
		<Provider store={createStore()}>
			<App />
		</Provider>,
	);

/**
 * Stubs `fetch` with a small stateful fake of the people API: POSTs append
 * to an in-memory list (linking the chosen partner both ways, as the real
 * server does) and GETs always return the current list. Being stateful
 * rather than a fixed sequence of canned responses keeps the test immune to
 * however many times RTK Query decides to refetch.
 *
 * Also stubs a permanently-logged-in-as-admin session for /api/auth/me —
 * AdminPage (this test's concern) is gated behind that on the real server,
 * so without it nothing here would ever render. The login flow itself is
 * covered separately in Auth.integration.test.tsx.
 *
 * This deliberately implements only what this test exercises — the full
 * reciprocal-link algorithm, with all its unlink-the-previous-partner edge
 * cases, is covered by the server's own suite against a real database.
 */
const stubPeopleApi = () => {
	const people: Person[] = [];
	let nextId = 1;

	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			// RTK Query's fetchBaseQuery calls fetch(request) with a pre-built
			// Request object rather than fetch(url, init) — the url/method live
			// on the Request itself, not in a separate init.
			const request = input instanceof Request ? input : new Request(input, init);
			const url = new URL(request.url);

			if (url.pathname === "/api/auth/me" && request.method === "GET") {
				return new Response(
					JSON.stringify({
						person: { id: 0, name: "Admin", email: "admin@example.com", phone: 0, isAdmin: true },
						mustChangePassword: false,
					}),
					{ status: 200 },
				);
			}

			if (url.pathname === "/api/people" && request.method === "GET") {
				return new Response(JSON.stringify(people), { status: 200 });
			}

			if (url.pathname === "/api/people" && request.method === "POST") {
				const body = (await request.json()) as Omit<Person, "id">;
				const created: Person = { ...body, id: nextId++ };
				people.push(created);

				if (created.partnerId !== undefined && created.partnerId !== null) {
					const partner = people.find((p) => p.id === created.partnerId);
					if (partner) {
						partner.partnerId = created.id;
					}
				}
				// The real API also returns a freshly generated initial password,
				// shown once — kept out of `people` above since it's never part of
				// what GET /people (or this list) returns afterwards.
				return new Response(JSON.stringify({ ...created, initialPassword: `pw-${created.id}` }), {
					status: 201,
				});
			}

			return new Response(null, { status: 204 });
		}),
	);

	return people;
};

afterEach(() => {
	vi.unstubAllGlobals();
	// See the identical comment in Auth.integration.test.tsx — RTL's
	// auto-cleanup needs a global `afterEach`, which this project doesn't
	// enable, so it never attaches without this.
	cleanup();
});

const addPerson = async (
	user: ReturnType<typeof userEvent.setup>,
	name: string,
	email: string,
	phone: string,
	partnerName?: string,
) => {
	// AdminPage is gated behind AdminRoute, which shows a "Loading…" state
	// until the (stubbed) /api/auth/me check resolves — findByLabelText
	// waits that out on the first call.
	await user.clear(await screen.findByLabelText("Name"));
	await user.clear(screen.getByLabelText("Email"));
	await user.clear(screen.getByLabelText("Phone"));
	await user.type(screen.getByLabelText("Name"), name);
	await user.type(screen.getByLabelText("Email"), email);
	await user.type(screen.getByLabelText("Phone"), phone);
	if (partnerName) {
		await user.selectOptions(
			screen.getByLabelText("Partner", { selector: "#partner" }),
			partnerName,
		);
	}
	await user.click(screen.getByRole("button", { name: "Add Person" }));
	// Adding a person shows a one-time "here's their initial password" banner
	// that repeats the person's name — dismiss it so later assertions in this
	// test that look up a person's name in the list stay unambiguous.
	await user.click(await screen.findByRole("button", { name: "Dismiss" }));
};

describe("App: renders people and their partners as returned by the API", () => {
	it("sends the chosen partner to the API and renders the link on both people", async () => {
		const people = stubPeopleApi();
		const user = userEvent.setup();
		renderApp();

		// Scoped to the list, and to the row's name element specifically — a
		// person's name legitimately also shows up as an option in every
		// partner dropdown, including other rows' in the same list.
		const nameInList = async (name: string) =>
			within(await screen.findByRole("list")).findByText(name, { selector: "p.font-medium" });

		await addPerson(user, "Bjørn", "bjorn@example.com", "11223344");
		await nameInList("Bjørn");

		await addPerson(user, "Anna", "anna@example.com", "22334455", "Bjørn");
		await nameInList("Anna");

		// The form sent Bjørn's id as the partner, and the server linked both ways.
		expect(people).toEqual([
			{ id: 1, name: "Bjørn", email: "bjorn@example.com", phone: 11223344, partnerId: 2 },
			{ id: 2, name: "Anna", email: "anna@example.com", phone: 22334455, partnerId: 1 },
		]);

		// ...and the list reflects that link on both rows.
		await waitFor(() => {
			const bjornPartnerSelect = screen.getByLabelText("Partner", {
				selector: "#partner-1",
			}) as HTMLSelectElement;
			expect(bjornPartnerSelect.value).toBe("2");
		});

		const annaPartnerSelect = screen.getByLabelText("Partner", {
			selector: "#partner-2",
		}) as HTMLSelectElement;
		expect(annaPartnerSelect.value).toBe("1");
	});
});
