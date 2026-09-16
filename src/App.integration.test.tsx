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

			const patchMatch = /^\/api\/people\/(\d+)$/.exec(url.pathname);
			if (patchMatch && request.method === "PATCH") {
				const patch = (await request.json()) as Partial<Person>;
				const person = people.find((p) => p.id === Number(patchMatch[1]));
				if (!person) {
					return new Response(JSON.stringify({ error: "No such person" }), { status: 404 });
				}

				if (
					patch.email !== undefined &&
					people.some((p) => p.id !== person.id && p.email === patch.email)
				) {
					return new Response(JSON.stringify({ error: "Email already in use" }), { status: 409 });
				}

				const { partnerId, ...rest } = patch;
				Object.assign(person, rest);
				// Partner links are reciprocal on the real server, and last year's
				// recipient deliberately isn't — the difference is worth keeping
				// here, since a test could otherwise pass on the wrong one.
				if (partnerId !== undefined) {
					for (const other of people) {
						if (other.partnerId === person.id) {
							other.partnerId = undefined;
						}
					}
					person.partnerId = partnerId ?? undefined;
					const partner = people.find((p) => p.id === partnerId);
					if (partner) {
						partner.partnerId = person.id;
					}
				}
				return new Response(JSON.stringify(person), { status: 200 });
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
	// The "Add people" form is collapsed by default — expand it if it isn't
	// already (it stays open across repeat calls within the same test, so
	// this is a no-op after the first). AdminPage is also gated behind
	// AdminRoute, which shows a "Loading…" state until the (stubbed)
	// /api/auth/me check resolves — findByText waits that out on the first call.
	if (screen.queryByLabelText("Name") === null) {
		await user.click(await screen.findByText("Add people"));
	}
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

/**
 * Opens the edit dialog for one person. Matched on the row's name element
 * specifically: a row also mentions whoever it's partnered with, so looking
 * for the name anywhere in the row would find the wrong one.
 */
const openEditDialogFor = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
	const rows = within(await screen.findByRole("list")).getAllByRole("listitem");
	const row = rows.find((r) => r.querySelector("p.font-medium")?.textContent === name);
	if (!row) {
		throw new Error(`No row found for ${name}`);
	}
	await user.click(within(row).getByRole("button", { name: "Edit" }));
	// Scoped to the dialog: the add-person form is open behind it and has
	// its own Name/Email/Phone fields with the same labels.
	return within(await screen.findByRole("dialog"));
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

		// ...and the list shows it on both rows, as plain text now that
		// changing it happens in the edit dialog instead.
		const rows = within(await screen.findByRole("list")).getAllByRole("listitem");
		await waitFor(() => {
			expect(rows[0]!.textContent).toContain("Partner:Anna");
		});
		expect(rows[1]!.textContent).toContain("Partner:Bjørn");
	});

	it("records last year's match from the edit dialog, without touching the other person", async () => {
		const people = stubPeopleApi();
		const user = userEvent.setup();
		renderApp();

		await addPerson(user, "Bjørn", "bjorn@example.com", "11223344");
		await addPerson(user, "Anna", "anna@example.com", "22334455");

		const dialog = await openEditDialogFor(user, "Anna");
		await user.selectOptions(dialog.getByLabelText("Last year"), "Bjørn");
		await user.click(dialog.getByRole("button", { name: "Save changes" }));

		// Anna gave to Bjørn last year. Who gave to *her* is a separate fact,
		// so unlike a partner link this sets nothing on Bjørn.
		await waitFor(() => {
			expect(people.find((p) => p.name === "Anna")?.lastYearRecipientId).toBe(1);
		});
		expect(people.find((p) => p.name === "Bjørn")?.lastYearRecipientId).toBeUndefined();
	});

	it("edits a person's own details from the dialog", async () => {
		const people = stubPeopleApi();
		const user = userEvent.setup();
		renderApp();

		await addPerson(user, "Anna", "anna@example.com", "22334455");

		const dialog = await openEditDialogFor(user, "Anna");
		await user.clear(dialog.getByLabelText("Name"));
		await user.type(dialog.getByLabelText("Name"), "Anna Marie");
		await user.clear(dialog.getByLabelText("Phone"));
		await user.type(dialog.getByLabelText("Phone"), "99887766");
		await user.click(dialog.getByRole("button", { name: "Save changes" }));

		await waitFor(() => {
			expect(people[0]).toMatchObject({ name: "Anna Marie", phone: 99887766 });
		});
		// The dialog closes on success rather than leaving them wondering.
		expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
	});

	it("keeps the dialog open and explains when the email is taken", async () => {
		stubPeopleApi();
		const user = userEvent.setup();
		renderApp();

		await addPerson(user, "Bjørn", "bjorn@example.com", "11223344");
		await addPerson(user, "Anna", "anna@example.com", "22334455");

		const dialog = await openEditDialogFor(user, "Anna");
		await user.clear(dialog.getByLabelText("Email"));
		await user.type(dialog.getByLabelText("Email"), "bjorn@example.com");
		await user.click(dialog.getByRole("button", { name: "Save changes" }));

		await dialog.findByText("That email is already registered to someone else");
		expect(dialog.getByRole("button", { name: "Save changes" })).not.toBeNull();
	});
});
