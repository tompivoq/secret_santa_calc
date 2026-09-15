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

interface DrawState {
	id: number;
	createdAt: string;
	lockedAt: string | null;
	assignments: { id: number; drawId: number; giverId: number; recipientId: number }[];
}

/**
 * Stubs a logged-in admin session, a fixed people list, and the draw
 * endpoints backed by a small in-memory draw — statefully, so that locking
 * in is actually reflected by the next GET /current, the way the real
 * server behaves. The matching itself is the server's job and is covered by
 * its own suite; this fake just cycles everyone in list order.
 */
const stubApi = (people: Person[], options: { onDraft?: () => Response } = {}) => {
	let draw: DrawState | null = null;
	let nextId = 1;
	/** The personIds sent with each draft request, for asserting on the selection. */
	const drafted: number[][] = [];

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
				return new Response(JSON.stringify(draw), { status: 200 });
			}

			if (url.pathname === "/api/matcher/draft" && request.method === "POST") {
				const { personIds } = (await request.json()) as { personIds: number[] };
				drafted.push(personIds);
				if (options.onDraft) {
					return options.onDraft();
				}
				const drawId = nextId++;
				draw = {
					id: drawId,
					createdAt: new Date().toISOString(),
					lockedAt: null,
					assignments: personIds.map((giverId, index) => ({
						id: nextId++,
						drawId,
						giverId,
						recipientId: personIds[(index + 1) % personIds.length]!,
					})),
				};
				return new Response(JSON.stringify({ draw, repeatedLastYear: false }), { status: 200 });
			}

			if (url.pathname === "/api/matcher/lock" && request.method === "POST") {
				if (!draw) {
					return new Response(JSON.stringify({ error: "There is no draft to lock in" }), {
						status: 409,
					});
				}
				draw = { ...draw, lockedAt: new Date().toISOString() };
				return new Response(JSON.stringify(draw), { status: 200 });
			}

			return new Response(null, { status: 204 });
		}),
	);

	return { drafted };
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
 * The rendered "Giver → Recipient" line for a giver, whichever recipient
 * they got. Scoped to the <li> itself: the surrounding <ul>'s text starts
 * with the first giver's line too, and would match just as well.
 */
const assignmentLineFor = (giver: string) =>
	screen.findByText(
		(_, el) => el?.tagName === "LI" && el.textContent?.startsWith(`${giver} → `) === true,
	);

describe("running a match from the admin page", () => {
	it("defaults to everyone selected, and shows the drafted match", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));

		expect(await assignmentLineFor("Anna")).not.toBeNull();
		expect(await assignmentLineFor("Bjørn")).not.toBeNull();
		expect(await assignmentLineFor("Carl")).not.toBeNull();
	});

	it("excludes a deselected person from the request", async () => {
		const { drafted } = stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await user.click(await screen.findByLabelText(`Include ${CARL.name} in the next match`));
		await screen.findByText("2 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));

		await assignmentLineFor("Anna");
		expect(drafted).toHaveLength(1);
		expect([...drafted[0]!].sort()).toEqual([ANNA.id, BJORN.id].sort());
	});

	it("disables the run button with fewer than 2 people selected", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await user.click(await screen.findByRole("button", { name: "Select none" }));
		await user.click(screen.getByLabelText(`Include ${ANNA.name} in the next match`));

		const button = screen.getByRole("button", { name: /Run match/ }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
	});

	it("shows a friendly message when no valid match exists for the selection", async () => {
		stubApi([ANNA, BJORN], {
			onDraft: () =>
				new Response(JSON.stringify({ error: "No valid matching exists for this group" }), {
					status: 422,
				}),
		});
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("2 of 2 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));

		await screen.findByText(/No valid match exists for the selected people/);
	});
});

describe("locking a draft in", () => {
	it("offers re-rolling until locked, then swaps to the locked view", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));
		await assignmentLineFor("Anna");

		// While it's a draft: re-rollable, and explicitly not final.
		expect(screen.getByText(/Nothing is final until you lock it in/)).not.toBeNull();
		expect(screen.getByRole("button", { name: /Re-roll/ })).not.toBeNull();

		await user.click(screen.getByRole("button", { name: "Lock in this match" }));

		// Once locked: no re-roll, and starting over is offered instead.
		await screen.findByText(/Locked in on/);
		expect(screen.queryByRole("button", { name: /Re-roll/ })).toBeNull();
		expect(screen.queryByRole("button", { name: "Lock in this match" })).toBeNull();
		expect(screen.getByRole("button", { name: "Start a new draw" })).not.toBeNull();
	});

	it("asks for confirmation before drawing over a locked result", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));
		await assignmentLineFor("Anna");
		await user.click(screen.getByRole("button", { name: "Lock in this match" }));
		await screen.findByText(/Locked in on/);

		await user.click(screen.getByRole("button", { name: "Start a new draw" }));

		// Nothing is re-drawn on the first click — it warns first.
		await screen.findByText(/Everyone's match will change/);
		expect(screen.getByText(/Locked in on/)).not.toBeNull();

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByText(/Everyone's match will change/)).toBeNull();
	});
});

describe("a draw that's already been run", () => {
	it("picks the locked draw back up on load, without re-running anything", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		const { unmount } = renderAdminPage();

		await screen.findByText("3 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));
		await assignmentLineFor("Anna");
		await user.click(screen.getByRole("button", { name: "Lock in this match" }));
		await screen.findByText(/Locked in on/);

		// A fresh store, as if the page had been reloaded: the draw is the
		// server's, not something held in component state.
		unmount();
		cleanup();
		renderAdminPage();

		await screen.findByText(/Locked in on/);
		expect(await assignmentLineFor("Anna")).not.toBeNull();
	});
});
