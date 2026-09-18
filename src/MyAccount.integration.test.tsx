/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import App from "./App";
import { createStore } from "./store/store";
import type { Person } from "./models/person";

const PERSON: Person = {
	id: 1,
	name: "Anna",
	email: "anna@example.com",
	phone: 22334455,
	isAdmin: false,
};

/**
 * A signed-in non-admin with a stateful "me": editing actually changes what
 * the next GET returns, so the page has to be reading the server rather
 * than whatever it had in hand.
 */
const stubApi = (options: { onPatchMe?: () => Response } = {}) => {
	let person: Person = { ...PERSON };
	const passwordChanges: { currentPassword?: string; newPassword: string }[] = [];
	/** Each self-edit request body, for asserting on what the form actually sends. */
	const patchedMe: Record<string, unknown>[] = [];

	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			const url = new URL(request.url);

			if (url.pathname === "/api/auth/me" && request.method === "GET") {
				return new Response(
					JSON.stringify({ person, mustChangePassword: false, requiresCurrentPassword: true }),
					{ status: 200 },
				);
			}

			if (url.pathname === "/api/auth/me" && request.method === "PATCH") {
				const patch = (await request.json()) as Partial<Person>;
				patchedMe.push(patch as Record<string, unknown>);
				if (options.onPatchMe) {
					return options.onPatchMe();
				}
				person = { ...person, ...patch };
				return new Response(JSON.stringify(person), { status: 200 });
			}

			if (url.pathname === "/api/auth/change-password" && request.method === "POST") {
				passwordChanges.push(
					(await request.json()) as { currentPassword?: string; newPassword: string },
				);
				return new Response(null, { status: 204 });
			}

			if (url.pathname === "/api/matcher/mine" && request.method === "GET") {
				return new Response(JSON.stringify({ recipient: null }), { status: 200 });
			}

			return new Response(null, { status: 204 });
		}),
	);

	return { passwordChanges, patchedMe, currentPerson: () => person };
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

const openDialog = async (user: ReturnType<typeof userEvent.setup>, button: string) => {
	await user.click(await screen.findByRole("button", { name: button }));
	return within(await screen.findByRole("dialog"));
};

/**
 * The "Dine info" card. Scoped rather than queried globally because the
 * nav bar also shows the signed-in person's name, so it alone matches twice.
 * Re-resolved on each call so it reflects the current render.
 */
const inDetails = () => within(screen.getByRole("region", { name: "Dine info" }));

const waitForDetails = () => screen.findByRole("heading", { name: "Dine info" });

describe("seeing and editing your own details", () => {
	it("shows your details, and not the draw settings", async () => {
		stubApi();
		renderAccountPage();

		await waitForDetails();
		expect(inDetails().getByText("Anna")).not.toBeNull();
		expect(inDetails().getByText("anna@example.com")).not.toBeNull();
		expect(inDetails().getByText("22334455")).not.toBeNull();
		// Partner and last year's recipient decide who you can be matched
		// with, so they're the admin's to set — not offered here at all.
		expect(inDetails().queryByText("Partner")).toBeNull();
		expect(inDetails().queryByText("Sidste år")).toBeNull();
	});

	it("saves a change and shows it afterwards", async () => {
		const { currentPerson } = stubApi();
		const user = userEvent.setup();
		renderAccountPage();

		await waitForDetails();
		const dialog = await openDialog(user, "Rediger din info");
		await user.clear(dialog.getByLabelText("Navn"));
		await user.type(dialog.getByLabelText("Navn"), "Anna Marie");
		await user.click(dialog.getByRole("button", { name: "Gem ændringer" }));

		await waitFor(() => expect(inDetails().getByText("Anna Marie")).not.toBeNull());
		expect(currentPerson().name).toBe("Anna Marie");
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("sends only the personal fields, never the draw settings", async () => {
		const { patchedMe } = stubApi();
		const user = userEvent.setup();
		renderAccountPage();

		await waitForDetails();
		const dialog = await openDialog(user, "Rediger din info");
		await user.clear(dialog.getByLabelText("Telefon-nummer"));
		await user.type(dialog.getByLabelText("Telefon-nummer"), "99887766");
		await user.click(dialog.getByRole("button", { name: "Gem ændringer" }));

		await waitFor(() => expect(patchedMe).toHaveLength(1));
		// The server refuses partner/lastYearRecipientId here regardless, but
		// the form shouldn't be asking in the first place.
		expect(Object.keys(patchedMe[0]!).sort()).toEqual(["email", "name", "phone"]);
	});

	it("explains a taken email and keeps the dialog open", async () => {
		stubApi({
			onPatchMe: () =>
				new Response(JSON.stringify({ error: "Email already in use" }), { status: 409 }),
		});
		const user = userEvent.setup();
		renderAccountPage();

		await waitForDetails();
		const dialog = await openDialog(user, "Rediger din info");
		await user.clear(dialog.getByLabelText("E-mail"));
		await user.type(dialog.getByLabelText("E-mail"), "taken@example.com");
		await user.click(dialog.getByRole("button", { name: "Gem ændringer" }));

		await dialog.findByText("Den indtastede e-mail er allerede brugt til en anden bruger");
		expect(screen.getByRole("dialog")).not.toBeNull();
	});
});

describe("changing your own password", () => {
	it("asks for the current password and sends both", async () => {
		const { passwordChanges } = stubApi();
		const user = userEvent.setup();
		renderAccountPage();

		await waitForDetails();
		const dialog = await openDialog(user, "Ændre password");

		// Changing it by choice, so the current one is required — unlike the
		// forced first-login flow reached from a magic link.
		await user.type(dialog.getByLabelText("Nuværende password"), "old-password");
		await user.type(dialog.getByLabelText("Nyt password"), "a-brand-new-password");
		await user.type(dialog.getByLabelText("Bekræft nyt password"), "a-brand-new-password");
		await user.click(dialog.getByRole("button", { name: "Sæt nyt password" }));

		await waitFor(() => expect(passwordChanges).toHaveLength(1));
		expect(passwordChanges[0]).toEqual({
			currentPassword: "old-password",
			newPassword: "a-brand-new-password",
		});
		// Closes on success rather than leaving them wondering.
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("doesn't call itself a first login", async () => {
		stubApi();
		const user = userEvent.setup();
		renderAccountPage();

		await waitForDetails();
		const dialog = await openDialog(user, "Ændre password");

		expect(dialog.queryByText(/Indstil et nyt password/)).toBeNull();
		expect(dialog.getByText(/Du skal bruge dit gamle/)).not.toBeNull();
	});
});
