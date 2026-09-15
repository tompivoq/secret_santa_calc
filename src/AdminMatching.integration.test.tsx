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
	blind: boolean;
	participantIds: number[];
	notifiedIds: number[];
	assignments?: { id: number; drawId: number; giverId: number; recipientId: number }[];
}

/**
 * Stubs a logged-in admin session, a fixed people list, and the draw
 * endpoints backed by a small in-memory draw — statefully, so that locking
 * in is actually reflected by the next GET /current, the way the real
 * server behaves. The matching itself is the server's job and is covered by
 * its own suite; this fake just cycles everyone in list order.
 */
const stubApi = (
	people: Person[],
	options: { onDraft?: () => Response; onNotify?: () => Response } = {},
) => {
	let draw: DrawState | null = null;
	let nextId = 1;
	/** Each draft request's body, for asserting on what the page actually asked for. */
	const drafted: { personIds: number[]; blind?: boolean }[] = [];

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
				const body = (await request.json()) as { personIds: number[]; blind?: boolean };
				const { personIds, blind } = body;
				drafted.push(body);
				if (options.onDraft) {
					return options.onDraft();
				}
				const drawId = nextId++;
				draw = {
					id: drawId,
					createdAt: new Date().toISOString(),
					lockedAt: null,
					blind: blind !== false,
					participantIds: personIds,
					notifiedIds: [],
					// Withheld for a blind draw, exactly as the real server does —
					// so a test that finds pairings on screen proves they were sent.
					...(blind === false && {
						assignments: personIds.map((giverId, index) => ({
							id: nextId++,
							drawId,
							giverId,
							recipientId: personIds[(index + 1) % personIds.length]!,
						})),
					}),
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

			if (url.pathname === "/api/matcher/notify" && request.method === "POST") {
				const { personIds } = (await request.json()) as { personIds?: number[] };
				if (options.onNotify) {
					return options.onNotify();
				}
				const targets =
					personIds ?? draw!.participantIds.filter((id) => !draw!.notifiedIds.includes(id));
				draw = { ...draw!, notifiedIds: [...new Set([...draw!.notifiedIds, ...targets])] };
				return new Response(
					JSON.stringify({
						notified: targets.map((id) => ({
							personId: id,
							name: people.find((p) => p.id === id)?.name ?? "Unknown",
						})),
						failed: [],
					}),
					{ status: 200 },
				);
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

/** Opts out of the default blind draw, for the tests that assert on pairings. */
const revealPairings = (user: ReturnType<typeof userEvent.setup>) =>
	user.click(screen.getByLabelText("Don't show me who drew whom"));

describe("running a match from the admin page", () => {
	it("defaults to everyone selected, and draws without revealing the pairings", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));

		// It drew, and says who took part...
		await screen.findByText("3 people");
		expect(screen.getByText(/Anna, Bjørn, Carl/)).not.toBeNull();
		// ...but not a single pairing, since the admin takes part too.
		expect(screen.queryByText(/ → /)).toBeNull();
		expect(screen.getByText(/Who drew whom is hidden/)).not.toBeNull();
	});

	it("shows the pairings when the admin opts out of a blind draw", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 of 3 selected");
		await revealPairings(user);
		await user.click(screen.getByRole("button", { name: /Run match/ }));

		expect(await assignmentLineFor("Anna")).not.toBeNull();
		expect(await assignmentLineFor("Bjørn")).not.toBeNull();
		expect(await assignmentLineFor("Carl")).not.toBeNull();
	});

	it("asks the server to hide them, rather than just not rendering them", async () => {
		const { drafted } = stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));
		await screen.findByText("3 people");

		// The distinction that matters: hiding is the server's job, so the
		// pairings aren't sitting in the network tab waiting to be read.
		expect(drafted[0]!.blind).toBe(true);
	});

	it("excludes a deselected person from the request", async () => {
		const { drafted } = stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await user.click(await screen.findByLabelText(`Include ${CARL.name} in the next match`));
		await screen.findByText("2 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));

		await screen.findByText("2 people");
		expect(drafted).toHaveLength(1);
		expect([...drafted[0]!.personIds].sort()).toEqual([ANNA.id, BJORN.id].sort());
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
		await screen.findByText("3 people");

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
		await screen.findByText("3 people");
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

describe("emailing people their link", () => {
	const drawAndLock = async (user: ReturnType<typeof userEvent.setup>) => {
		await screen.findByText("3 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));
		await screen.findByText("3 people");
		await user.click(screen.getByRole("button", { name: "Lock in this match" }));
		await screen.findByText(/Locked in on/);
	};

	it("is offered only once the draw is locked in", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));
		await screen.findByText("3 people");

		// Still a draft: it can still be re-rolled, so nobody may be told yet.
		expect(screen.queryByRole("button", { name: /Email the/ })).toBeNull();

		await user.click(screen.getByRole("button", { name: "Lock in this match" }));

		expect(await screen.findByRole("button", { name: /Email the 3 still waiting/ })).not.toBeNull();
	});

	it("tracks who has been emailed, and offers a resend once everyone has", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();
		await drawAndLock(user);

		expect(screen.getByText("0 of 3 have been emailed their link.")).not.toBeNull();

		await user.click(screen.getByRole("button", { name: /Email the 3 still waiting/ }));

		await screen.findByText("3 of 3 have been emailed their link.");
		expect(screen.getByText(/Emailed Anna, Bjørn, Carl/)).not.toBeNull();
		// Nobody left waiting, so the offer changes to resending.
		expect(screen.queryByRole("button", { name: /still waiting/ })).toBeNull();
		expect(screen.getByRole("button", { name: /Send everyone their link again/ })).not.toBeNull();
	});

	it("names the people whose emails failed, rather than just counting them", async () => {
		stubApi([ANNA, BJORN, CARL], {
			onNotify: () =>
				new Response(
					JSON.stringify({
						notified: [{ personId: ANNA.id, name: "Anna" }],
						failed: [{ personId: BJORN.id, name: "Bjørn", error: "Domain is not verified" }],
					}),
					{ status: 200 },
				),
		});
		const user = userEvent.setup();
		renderAdminPage();
		await drawAndLock(user);

		await user.click(screen.getByRole("button", { name: /Email the 3 still waiting/ }));

		// The admin has to know who to chase; a count alone wouldn't say.
		await screen.findByText(/Bjørn — Domain is not verified/);
		expect(screen.getByText(/couldn't be emailed/)).not.toBeNull();
	});
});

describe("a draw that's already been run", () => {
	it("picks the locked draw back up on load, without re-running anything", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		const { unmount } = renderAdminPage();

		await screen.findByText("3 of 3 selected");
		await user.click(screen.getByRole("button", { name: /Run match/ }));
		await screen.findByText("3 people");
		await user.click(screen.getByRole("button", { name: "Lock in this match" }));
		await screen.findByText(/Locked in on/);

		// A fresh store, as if the page had been reloaded: the draw is the
		// server's, not something held in component state.
		unmount();
		cleanup();
		renderAdminPage();

		await screen.findByText(/Locked in on/);
		expect(await screen.findByText("3 people")).not.toBeNull();
		// Still hidden after the reload — blindness is a property of the
		// stored draw, not of the click that happened to create it.
		expect(screen.getByText(/Who drew whom is hidden/)).not.toBeNull();
	});
});
