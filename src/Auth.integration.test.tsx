/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

interface StubAuthApiOptions {
	password?: string;
	/** The person this session belongs to — swap in an admin PERSON to test the admin-gated page. */
	person?: Person;
	/** Skip straight to a logged-in session, as if login already happened. */
	startAuthenticated?: boolean;
	/** Whether the session starts with a pending forced password change. */
	mustChangePassword?: boolean;
}

/**
 * Stubs `fetch` with a small stateful fake of the auth API: one seeded
 * person with a known initial password, a `mustChangePassword` flag, and a
 * boolean standing in for "has a valid session cookie" (real cookie
 * handling isn't exercised here — that's covered by the server's own tests
 * against the real HTTP layer).
 */
const stubAuthApi = ({
	password = "initial-pw",
	person = PERSON,
	startAuthenticated = false,
	mustChangePassword = true,
}: StubAuthApiOptions = {}) => {
	const state = { password, mustChangePassword, authenticated: startAuthenticated };

	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			const url = new URL(request.url);

			if (url.pathname === "/api/auth/login" && request.method === "POST") {
				const { email, password: given } = (await request.json()) as {
					email: string;
					password: string;
				};
				if (email !== person.email || given !== state.password) {
					return new Response(JSON.stringify({ error: "Invalid email or password" }), {
						status: 401,
					});
				}
				state.authenticated = true;
				return new Response(
					JSON.stringify({ person, mustChangePassword: state.mustChangePassword }),
					{ status: 200 },
				);
			}

			if (url.pathname === "/api/auth/me" && request.method === "GET") {
				if (!state.authenticated) {
					return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
				}
				return new Response(
					JSON.stringify({ person, mustChangePassword: state.mustChangePassword }),
					{ status: 200 },
				);
			}

			if (url.pathname === "/api/auth/change-password" && request.method === "POST") {
				if (!state.authenticated) {
					return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
				}
				const { currentPassword, newPassword } = (await request.json()) as {
					currentPassword: string;
					newPassword: string;
				};
				if (currentPassword !== state.password) {
					return new Response(JSON.stringify({ error: "Current password is incorrect" }), {
						status: 401,
					});
				}
				state.password = newPassword;
				state.mustChangePassword = false;
				return new Response(null, { status: 204 });
			}

			if (url.pathname === "/api/auth/logout" && request.method === "POST") {
				state.authenticated = false;
				return new Response(null, { status: 204 });
			}

			// AdminPage (rendered when an admin reaches "/") fetches the people
			// list too — an empty one is enough for these tests, which are only
			// concerned with who gets to see the page at all.
			if (url.pathname === "/api/people" && request.method === "GET") {
				return new Response(JSON.stringify([]), { status: 200 });
			}

			return new Response(null, { status: 204 });
		}),
	);

	return state;
};

afterEach(() => {
	vi.unstubAllGlobals();
	// @testing-library/react's auto-cleanup only attaches when it can find
	// `afterEach` as a global — this project deliberately doesn't enable
	// vitest's `globals` option, so it never does. Without this, each test's
	// rendered tree stays mounted into the next one, in the same jsdom
	// document — harmless for tests that only look for something being
	// present, but exactly what breaks a test asserting something is absent.
	cleanup();
});

const renderAt = (path: string) => {
	window.history.pushState({}, "", path);
	return render(
		<Provider store={createStore()}>
			<App />
		</Provider>,
	);
};

describe("logging in", () => {
	it("forces a password change on first login, then shows the account view", async () => {
		stubAuthApi();
		const user = userEvent.setup();
		renderAt("/login");

		await user.type(screen.getByLabelText("Email"), PERSON.email);
		await user.type(screen.getByLabelText("Password"), "initial-pw");
		await user.click(screen.getByRole("button", { name: "Log in" }));

		await screen.findByText("This is your first time logging in — please set a new password.");

		// A non-admin gets no way into the people-management page — see the
		// "admin access" describe block below for the page itself being gated.
		expect(screen.queryByRole("link", { name: "Manage people" })).toBeNull();

		await user.type(screen.getByLabelText("Current password"), "initial-pw");
		await user.type(screen.getByLabelText("New password"), "a-brand-new-password");
		await user.type(screen.getByLabelText("Confirm new password"), "a-brand-new-password");
		await user.click(screen.getByRole("button", { name: "Set password" }));

		await screen.findByText("You haven't been matched yet — check back after the draw.");
	});

	it("shows an error and stays on the login page for the wrong password", async () => {
		stubAuthApi();
		const user = userEvent.setup();
		renderAt("/login");

		await user.type(screen.getByLabelText("Email"), PERSON.email);
		await user.type(screen.getByLabelText("Password"), "the-wrong-password");
		await user.click(screen.getByRole("button", { name: "Log in" }));

		await screen.findByText("Incorrect email or password");
	});

	it("does not bounce back to /login while the invalidated me-query is still refetching", async () => {
		// A GET /api/auth/me that never resolves, standing in for a refetch
		// that's simply slow — the account page must render from what login()
		// already returned, not wait on (or read stale data from) this.
		let meCalls = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const request = input instanceof Request ? input : new Request(input, init);
				const url = new URL(request.url);

				if (url.pathname === "/api/auth/login" && request.method === "POST") {
					return new Response(JSON.stringify({ person: PERSON, mustChangePassword: false }), {
						status: 200,
					});
				}

				if (url.pathname === "/api/auth/me" && request.method === "GET") {
					meCalls += 1;
					// The pre-login check on mount: genuinely not authenticated yet.
					if (meCalls === 1) {
						return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
					}
					// The post-login, invalidation-triggered refetch: hangs forever.
					return new Promise<Response>(() => {});
				}

				return new Response(null, { status: 204 });
			}),
		);

		const user = userEvent.setup();
		renderAt("/login");

		await user.type(screen.getByLabelText("Email"), PERSON.email);
		await user.type(screen.getByLabelText("Password"), "whatever");
		await user.click(screen.getByRole("button", { name: "Log in" }));

		// Without the fix, RequireAuth would instead read the still-cached
		// pre-login 401 (the me-query refetch above never settles to replace
		// it) and redirect straight back to /login.
		await screen.findByText("You haven't been matched yet — check back after the draw.");
	});
});

describe("logging out", () => {
	it("hides the nav's links and signed-in info, not just the page content", async () => {
		stubAuthApi({ startAuthenticated: true, mustChangePassword: false });
		const user = userEvent.setup();
		renderAt("/account");

		await screen.findByText("You haven't been matched yet — check back after the draw.");
		expect(screen.getByRole("link", { name: "My account" })).not.toBeNull();

		await user.click(screen.getByRole("button", { name: "Log out" }));

		// Redirected to the login page...
		await screen.findByLabelText("Email");
		// ...and the nav bar — which stays mounted across route changes,
		// unlike the page content it wraps — no longer shows the signed-in
		// links either. Before the fix, TopBarNav kept rendering them because
		// it only checked `me !== undefined`: RTK Query keeps the last
		// successful `data` around even once the invalidated "me" query's
		// refetch errors, so `me` alone stayed truthy after logout.
		expect(screen.queryByRole("link", { name: "My account" })).toBeNull();
		expect(screen.queryByText(/Signed in as/)).toBeNull();
	});
});

describe("admin access to the people-management page", () => {
	it("shows a 'no access' message to a logged-in non-admin who visits it directly", async () => {
		stubAuthApi({ startAuthenticated: true, mustChangePassword: false });
		renderAt("/");

		await screen.findByText("You don't have access to this page.");
		expect(screen.queryByLabelText("Name")).toBeNull();
	});

	it("shows the page, and the nav link, to a logged-in admin", async () => {
		const admin: Person = { ...PERSON, isAdmin: true };
		stubAuthApi({ person: admin, startAuthenticated: true, mustChangePassword: false });
		renderAt("/");

		// The "Add people" form is collapsed by default — its toggle is enough
		// to prove the admin page itself rendered.
		await screen.findByText("Add people");
		expect(screen.getByRole("link", { name: "Manage people" })).not.toBeNull();
	});
});

describe("a pending forced password change blocks every other page", () => {
	it("redirects away from the account page to the change-password form", async () => {
		stubAuthApi({ startAuthenticated: true, mustChangePassword: true });
		renderAt("/account");

		await screen.findByText("This is your first time logging in — please set a new password.");
		expect(
			screen.queryByText("You haven't been matched yet — check back after the draw."),
		).toBeNull();
	});

	it("redirects an admin away from the people-management page to the change-password form", async () => {
		const admin: Person = { ...PERSON, isAdmin: true };
		stubAuthApi({ person: admin, startAuthenticated: true, mustChangePassword: true });
		renderAt("/");

		await screen.findByText("This is your first time logging in — please set a new password.");
		expect(screen.queryByLabelText("Name")).toBeNull();
	});

	it("bounces away from the change-password page once nothing is pending", async () => {
		stubAuthApi({ startAuthenticated: true, mustChangePassword: false });
		renderAt("/change-password");

		await screen.findByText("You haven't been matched yet — check back after the draw.");
	});

	it("does not bounce back to /change-password while the invalidated me-query is still refetching", async () => {
		// Same race as the login one above, on the change-password → /account
		// hop instead: a GET /api/auth/me that never resolves after the
		// password is changed, standing in for a refetch that's simply slow.
		let meCalls = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const request = input instanceof Request ? input : new Request(input, init);
				const url = new URL(request.url);

				if (url.pathname === "/api/auth/me" && request.method === "GET") {
					meCalls += 1;
					// The mount check, before the password is changed.
					if (meCalls === 1) {
						return new Response(JSON.stringify({ person: PERSON, mustChangePassword: true }), {
							status: 200,
						});
					}
					// The post-change-password, invalidation-triggered refetch: hangs forever.
					return new Promise<Response>(() => {});
				}

				if (url.pathname === "/api/auth/change-password" && request.method === "POST") {
					return new Response(null, { status: 204 });
				}

				return new Response(null, { status: 204 });
			}),
		);

		const user = userEvent.setup();
		renderAt("/change-password");

		await screen.findByText("This is your first time logging in — please set a new password.");

		await user.type(screen.getByLabelText("Current password"), "initial-pw");
		await user.type(screen.getByLabelText("New password"), "a-brand-new-password");
		await user.type(screen.getByLabelText("Confirm new password"), "a-brand-new-password");
		await user.click(screen.getByRole("button", { name: "Set password" }));

		// Without the fix, RequireAuth would instead read the still-cached
		// mustChangePassword: true (the me-query refetch above never settles
		// to replace it) and redirect straight back to /change-password.
		await screen.findByText("You haven't been matched yet — check back after the draw.");
	});
});
