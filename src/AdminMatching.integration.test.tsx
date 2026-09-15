/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
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
};

const ANNA: Person = {
	id: 2,
	name: "Anna",
	email: "anna@example.com",
	phone: 22334455,
	isAdmin: false,
};
const BJORN: Person = {
	id: 3,
	name: "Bjørn",
	email: "bjorn@example.com",
	phone: 11223344,
	isAdmin: false,
};
const CARL: Person = {
	id: 4,
	name: "Carl",
	email: "carl@example.com",
	phone: 33445566,
	isAdmin: false,
};

/**
 * Stubs a logged-in admin session, a fixed people list, and POST
 * /api/matcher via the given handler — the matching algorithm itself is
 * covered by the server's own tests, so these tests only care that the page
 * sends the right ids and renders whatever comes back.
 */
const stubApi = (people: Person[], onMatch: (personIds: number[]) => Response) => {
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

			if (url.pathname === "/api/matcher" && request.method === "POST") {
				const { personIds } = (await request.json()) as { personIds: number[] };
				return onMatch(personIds);
			}

			return new Response(null, { status: 204 });
		}),
	);
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

describe("running a match from the admin page", () => {
	it("defaults to everyone selected, and previews the match the server returns", async () => {
		stubApi([ANNA, BJORN, CARL], (personIds) => {
			expect(personIds.sort()).toEqual([ANNA.id, BJORN.id, CARL.id].sort());
			return new Response(
				JSON.stringify([
					{ ...ANNA, hasMatch: true, currentTarget: BJORN.id },
					{ ...BJORN, hasMatch: true, currentTarget: CARL.id },
					{ ...CARL, hasMatch: true, currentTarget: ANNA.id },
				]),
				{ status: 200 },
			);
		});
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Preview match/ }));

		const results = await screen.findByText((_, el) => el?.textContent === "Anna → Bjørn");
		expect(results).not.toBeNull();
		expect(screen.getByText((_, el) => el?.textContent === "Bjørn → Carl")).not.toBeNull();
		expect(screen.getByText((_, el) => el?.textContent === "Carl → Anna")).not.toBeNull();
	});

	it("excludes a deselected person from the request", async () => {
		stubApi([ANNA, BJORN, CARL], (personIds) => {
			expect(personIds.sort()).toEqual([ANNA.id, BJORN.id].sort());
			return new Response(
				JSON.stringify([
					{ ...ANNA, hasMatch: true, currentTarget: BJORN.id },
					{ ...BJORN, hasMatch: true, currentTarget: ANNA.id },
				]),
				{ status: 200 },
			);
		});
		const user = userEvent.setup();
		renderAdminPage();

		await user.click(await screen.findByLabelText(`Include ${CARL.name} in the next match`));
		await screen.findByText("2 of 3 selected");

		await user.click(screen.getByRole("button", { name: /Preview match/ }));

		await screen.findByText((_, el) => el?.textContent === "Anna → Bjørn");
	});

	it("disables the preview button with fewer than 2 people selected", async () => {
		stubApi([ANNA, BJORN, CARL], () => new Response(null, { status: 204 }));
		const user = userEvent.setup();
		renderAdminPage();

		await user.click(await screen.findByRole("button", { name: "Select none" }));
		await user.click(screen.getByLabelText(`Include ${ANNA.name} in the next match`));

		const button = screen.getByRole("button", { name: /Preview match/ }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
	});

	it("shows a friendly message when no valid match exists for the selection", async () => {
		stubApi(
			[ANNA, BJORN],
			() =>
				new Response(JSON.stringify({ error: "No valid matching exists for this group" }), {
					status: 422,
				}),
		);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("2 of 2 selected");
		await user.click(screen.getByRole("button", { name: /Preview match/ }));

		await screen.findByText(/No valid match exists for the selected people/);
	});
});
