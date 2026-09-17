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

/**
 * Turns the default test-run into the real thing by unticking the box, for
 * the tests about a draw nobody — the admin included — gets to see.
 */
const makeItTheRealDraw = (user: ReturnType<typeof userEvent.setup>) =>
	user.click(screen.getByLabelText("Test-kørsel"));

describe("running a match from the admin page", () => {
	it("defaults to a test run, which shows the pairings", async () => {
		const { drafted } = stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 af 3 valgt");
		await user.click(screen.getByRole("button", { name: /Kør lodtrækning/ }));

		expect(await assignmentLineFor("Anna")).not.toBeNull();
		expect(await assignmentLineFor("Bjørn")).not.toBeNull();
		expect(await assignmentLineFor("Carl")).not.toBeNull();
		expect(drafted[0]!.blind).toBe(false);
	});

	it("hides the pairings once the test-run box is unticked", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 af 3 valgt");
		await makeItTheRealDraw(user);
		await user.click(screen.getByRole("button", { name: /Kør lodtrækning/ }));

		// Says who took part...
		await screen.findByText("3 deltagere");
		expect(screen.getByText(/Anna, Bjørn, Carl/)).not.toBeNull();
		// ...but not a single pairing, since the admin takes part too.
		expect(screen.queryByText(/ → /)).toBeNull();
		expect(screen.getByText(/Resultatet vil være skjult/)).not.toBeNull();
	});

	it("asks the server to hide them, rather than just not rendering them", async () => {
		const { drafted } = stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 af 3 valgt");
		await makeItTheRealDraw(user);
		await user.click(screen.getByRole("button", { name: /Kør lodtrækning/ }));
		await screen.findByText("3 deltagere");

		// The distinction that matters: hiding is the server's job, so the
		// pairings aren't sitting in the network tab waiting to be read.
		expect(drafted[0]!.blind).toBe(true);
	});

	it("excludes a deselected person from the request", async () => {
		const { drafted } = stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await user.click(await screen.findByLabelText(`Inkluder ${CARL.name} i næste lodtrækning`));
		await screen.findByText("2 af 3 valgt");
		await user.click(screen.getByRole("button", { name: /Kør lodtrækning/ }));

		await assignmentLineFor("Anna");
		expect(drafted).toHaveLength(1);
		expect([...drafted[0]!.personIds].sort()).toEqual([ANNA.id, BJORN.id].sort());
	});

	it("disables the run button with fewer than 2 people selected", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await user.click(await screen.findByRole("button", { name: "Vælg ingen" }));
		await user.click(screen.getByLabelText(`Inkluder ${ANNA.name} i næste lodtrækning`));

		const button = screen.getByRole("button", { name: /Kør lodtrækning/ }) as HTMLButtonElement;
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

		await screen.findByText("2 af 2 valgt");
		await user.click(screen.getByRole("button", { name: /Kør lodtrækning/ }));

		await screen.findByText(/Ingen gyldig lodtrækning fundet for de valgte deltagere/);
	});
});

describe("locking a draft in", () => {
	it("offers re-rolling until locked, then swaps to the locked view", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 af 3 valgt");
		await user.click(screen.getByRole("button", { name: /Kør lodtrækning/ }));
		await assignmentLineFor("Anna");

		// While it's a draft: re-rollable, and explicitly not final.
		expect(screen.getByText(/Intet er endeligt før du låser lodtrækningen fast/)).not.toBeNull();
		expect(screen.getByRole("button", { name: /Re-roll/ })).not.toBeNull();

		await user.click(screen.getByRole("button", { name: "Lås denne trækning" }));

		// Once locked: no re-roll, and starting over is offered instead.
		await screen.findByText(/Låst fast d/);
		expect(screen.queryByRole("button", { name: /Re-roll/ })).toBeNull();
		expect(screen.queryByRole("button", { name: "Lås denne trækning" })).toBeNull();
		expect(screen.getByRole("button", { name: "Start en ny trækning" })).not.toBeNull();
	});

	it("asks for confirmation before drawing over a locked result", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 af 3 valgt");
		await user.click(screen.getByRole("button", { name: /Kør lodtrækning/ }));
		await assignmentLineFor("Anna");
		await user.click(screen.getByRole("button", { name: "Lås denne trækning" }));
		await screen.findByText(/Låst fast d/);

		await user.click(screen.getByRole("button", { name: "Start en ny trækning" }));

		// Nothing is re-drawn on the first click — it warns first.
		await screen.findByText(/Alles match vil ændres/);
		expect(screen.getByText(/Låst fast d/)).not.toBeNull();

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByText(/Alles match vil ændres/)).toBeNull();
	});
});

describe("emailing people their link", () => {
	const drawAndLock = async (user: ReturnType<typeof userEvent.setup>) => {
		await screen.findByText("3 af 3 valgt");
		await user.click(screen.getByRole("button", { name: /Kør lodtrækning/ }));
		await assignmentLineFor("Anna");
		await user.click(screen.getByRole("button", { name: "Lås denne trækning" }));
		await screen.findByText(/Låst fast d/);
	};

	it("is offered only once the draw is locked in", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();

		await screen.findByText("3 af 3 valgt");
		await user.click(screen.getByRole("button", { name: /Kør lodtrækning/ }));
		await assignmentLineFor("Anna");

		// Still a draft: it can still be re-rolled, so nobody may be told yet.
		expect(screen.queryByRole("button", { name: /Send email til de/ })).toBeNull();

		await user.click(screen.getByRole("button", { name: "Lås denne trækning" }));

		expect(
			await screen.findByRole("button", { name: /Send email til de 3 der stadig venter/ }),
		).not.toBeNull();
	});

	it("tracks who has been emailed, and offers a resend once everyone has", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		renderAdminPage();
		await drawAndLock(user);

		expect(screen.getByText("0 ud af 3 har fået tilsendt deres login-link.")).not.toBeNull();

		await user.click(screen.getByRole("button", { name: /Send email til de 3 der stadig venter/ }));

		await screen.findByText("3 ud af 3 har fået tilsendt deres login-link.");
		expect(screen.getByText(/Sendte email til Anna, Bjørn, Carl/)).not.toBeNull();
		// Nobody left waiting, so the offer changes to resending.
		expect(screen.queryByRole("button", { name: /stadig venter/ })).toBeNull();
		expect(screen.getByRole("button", { name: /Send alle deres link igen/ })).not.toBeNull();
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

		await user.click(screen.getByRole("button", { name: /Send email til de 3 der stadig venter/ }));

		// The admin has to know who to chase; a count alone wouldn't say.
		await screen.findByText(/Bjørn — Domain is not verified/);
		expect(screen.getByText(/Kunne ikke sende til disse deltagere/)).not.toBeNull();
	});
});

describe("a draw that's already been run", () => {
	it("picks the locked draw back up on load, without re-running anything", async () => {
		stubApi([ANNA, BJORN, CARL]);
		const user = userEvent.setup();
		const { unmount } = renderAdminPage();

		await screen.findByText("3 af 3 valgt");
		// The real draw, so there's something hidden to still be hidden after.
		await makeItTheRealDraw(user);
		await user.click(screen.getByRole("button", { name: /Kør lodtrækning/ }));
		await screen.findByText("3 deltagere");
		await user.click(screen.getByRole("button", { name: "Lås denne trækning" }));
		await screen.findByText(/Låst fast d/);

		// A fresh store, as if the page had been reloaded: the draw is the
		// server's, not something held in component state.
		unmount();
		cleanup();
		renderAdminPage();

		await screen.findByText(/Låst fast d/);
		expect(await screen.findByText("3 deltagere")).not.toBeNull();
		// Still hidden after the reload — blindness is a property of the
		// stored draw, not of the click that happened to create it.
		expect(screen.getByText(/Resultatet vil være skjult/)).not.toBeNull();
	});
});
