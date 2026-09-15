/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import App from "./App";
import { createStore } from "./store/store";
import type { Person } from "./models/person";

const PERSON: Person = {
	id: 1,
	name: "Bjørn",
	email: "bjorn@example.com",
	phone: 11223344,
	isAdmin: false,
};

/** Stubs a signed-in session plus whatever GET /api/matcher/mine should answer. */
const stubApi = (mine: { recipient: { id: number; name: string } | null; drawnAt?: string }) => {
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
				return new Response(JSON.stringify(mine), { status: 200 });
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

const renderAccountPage = () => {
	window.history.pushState({}, "", "/account");
	return render(
		<Provider store={createStore()}>
			<App />
		</Provider>,
	);
};

describe("seeing your own match", () => {
	it("shows who you're the secret santa for once the draw is locked in", async () => {
		stubApi({ recipient: { id: 2, name: "Anna" }, drawnAt: new Date().toISOString() });
		renderAccountPage();

		await screen.findByText("Anna");
		expect(screen.getByText("You're the secret santa for")).not.toBeNull();
	});

	it("still says nothing has been drawn when there's no match yet", async () => {
		stubApi({ recipient: null });
		renderAccountPage();

		await screen.findByText("You haven't been matched yet — check back after the draw.");
		expect(screen.queryByText("You're the secret santa for")).toBeNull();
	});
});
