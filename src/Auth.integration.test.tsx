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
	/** False stands in for a session started by following an emailed login link. */
	requiresCurrentPassword?: boolean;
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
	requiresCurrentPassword = true,
}: StubAuthApiOptions = {}) => {
	const state = { password, mustChangePassword, authenticated: startAuthenticated };
	/** The bodies sent to change-password, for asserting on what was actually submitted. */
	const changeRequests: { currentPassword?: string; newPassword: string }[] = [];

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
					JSON.stringify({
						person,
						mustChangePassword: state.mustChangePassword,
						requiresCurrentPassword,
					}),
					{ status: 200 },
				);
			}

			if (url.pathname === "/api/auth/change-password" && request.method === "POST") {
				if (!state.authenticated) {
					return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
				}
				const body = (await request.json()) as {
					currentPassword?: string;
					newPassword: string;
				};
				changeRequests.push(body);
				const { currentPassword, newPassword } = body;
				// Mirrors the server: the current password is checked unless this
				// is someone setting their first one from a magic-link session.
				if (requiresCurrentPassword && currentPassword !== state.password) {
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

	return { state, changeRequests };
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

		await user.type(screen.getByLabelText("E-mail"), PERSON.email);
		await user.type(screen.getByLabelText("Password"), "initial-pw");
		await user.click(screen.getByRole("button", { name: "Log ind" }));

		await screen.findByText("Indstil et nyt password");

		// A non-admin gets no way into the people-management page — see the
		// "admin access" describe block below for the page itself being gated.
		expect(screen.queryByRole("link", { name: "Deltagere" })).toBeNull();

		await user.type(screen.getByLabelText("Nuværende password"), "initial-pw");
		await user.type(screen.getByLabelText("Nyt password"), "a-brand-new-password");
		await user.type(screen.getByLabelText("Bekræft nyt password"), "a-brand-new-password");
		await user.click(screen.getByRole("button", { name: "Sæt nyt password" }));

		await screen.findByText(/Nisserne har ikke trukket lod endnu/);
	});

	it("explains an expired magic link rather than silently showing the login form", async () => {
		stubAuthApi();
		renderAt("/login?error=link-expired");

		// Where GET /api/auth/magic/:token redirects a link that's already been
		// followed. Without this it looks like an unexplained trip to /login.
		await screen.findByText(/Dit link er allerede blevet brugt/);
	});

	it("shows an error and stays on the login page for the wrong password", async () => {
		stubAuthApi();
		const user = userEvent.setup();
		renderAt("/login");

		await user.type(screen.getByLabelText("E-mail"), PERSON.email);
		await user.type(screen.getByLabelText("Password"), "the-wrong-password");
		await user.click(screen.getByRole("button", { name: "Log ind" }));

		await screen.findByText("Forkert email eller password");
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

		await user.type(screen.getByLabelText("E-mail"), PERSON.email);
		await user.type(screen.getByLabelText("Password"), "whatever");
		await user.click(screen.getByRole("button", { name: "Log ind" }));

		// Without the fix, RequireAuth would instead read the still-cached
		// pre-login 401 (the me-query refetch above never settles to replace
		// it) and redirect straight back to /login.
		await screen.findByText(/Nisserne har ikke trukket lod endnu/);
	});
});

describe("logging out", () => {
	it("hides the nav's links and signed-in info, not just the page content", async () => {
		// As an admin, because only admins get nav links at all now — a
		// non-admin has nothing to see disappear, which would let the absence
		// checks below pass without proving anything.
		const admin: Person = { ...PERSON, isAdmin: true };
		stubAuthApi({ person: admin, startAuthenticated: true, mustChangePassword: false });
		const user = userEvent.setup();
		renderAt("/account");

		await screen.findByText(/Nisserne har ikke trukket lod endnu/);
		expect(screen.getByRole("link", { name: "Min side" })).not.toBeNull();
		expect(screen.getByRole("button", { name: "Log ud" })).not.toBeNull();

		await user.click(screen.getByRole("button", { name: "Log ud" }));

		// Redirected to the login page...
		await screen.findByLabelText("E-mail");
		// ...and the nav bar — which stays mounted across route changes,
		// unlike the page content it wraps — no longer shows the signed-in
		// links either. Before the fix, TopBarNav kept rendering them because
		// it only checked `me !== undefined`: RTK Query keeps the last
		// successful `data` around even once the invalidated "me" query's
		// refetch errors, so `me` alone stayed truthy after logout.
		expect(screen.queryByRole("link", { name: "Min side" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Log ud" })).toBeNull();
	});
});

describe("admin access to the people-management page", () => {
	it("sends a logged-in non-admin who visits it directly to their own account page", async () => {
		stubAuthApi({ startAuthenticated: true, mustChangePassword: false });
		renderAt("/");

		// "/" is where everyone lands, so a non-admin is taken somewhere
		// useful rather than told they can't be there.
		await screen.findByText(/Nisserne har ikke trukket lod endnu/);
		expect(window.location.pathname).toBe("/account");
		expect(screen.queryByText("Tilføj person")).toBeNull();
		expect(screen.queryByText("Du har desværre ikke adgang til denne side")).toBeNull();
	});

	it("still shows a 'no access' message on other admin-only pages", async () => {
		stubAuthApi({ startAuthenticated: true, mustChangePassword: false });
		renderAt("/styleguide");

		await screen.findByText("Du har desværre ikke adgang til denne side");
		expect(screen.queryByRole("heading", { name: "Style guide" })).toBeNull();
	});

	it("shows the page, and the nav link, to a logged-in admin", async () => {
		const admin: Person = { ...PERSON, isAdmin: true };
		stubAuthApi({ person: admin, startAuthenticated: true, mustChangePassword: false });
		renderAt("/");

		// The "Add people" form is collapsed by default — its toggle is enough
		// to prove the admin page itself rendered.
		await screen.findByText("Tilføj person");
		expect(screen.getByRole("link", { name: "Deltagere" })).not.toBeNull();
	});
});

describe("arriving from a magic link with no password yet", () => {
	it("is still sent to set a password, without being asked for the current one", async () => {
		// What the server reports for a link-originated session belonging to
		// someone who has never chosen a password.
		const { changeRequests } = stubAuthApi({
			startAuthenticated: true,
			mustChangePassword: true,
			requiresCurrentPassword: false,
		});
		const user = userEvent.setup();
		renderAt("/account");

		// Sent to set one, rather than straight through to their match...
		await screen.findByText(/Vælg venligst et password/);
		// ...and not asked for a password they have never had.
		expect(screen.queryByLabelText("Nuværende password")).toBeNull();

		await user.type(screen.getByLabelText("Nyt password"), "a-brand-new-password");
		await user.type(screen.getByLabelText("Bekræft nyt password"), "a-brand-new-password");
		await user.click(screen.getByRole("button", { name: "Sæt nyt password" }));

		await screen.findByText(/Nisserne har ikke trukket lod endnu/);
		expect(changeRequests).toEqual([{ newPassword: "a-brand-new-password" }]);
	});

	it("still asks for it when the session came from a password login", async () => {
		stubAuthApi({ startAuthenticated: true, mustChangePassword: true });
		renderAt("/account");

		await screen.findByText("Indstil et nyt password");
		expect(screen.getByLabelText("Nuværende password")).not.toBeNull();
	});
});

describe("a pending forced password change blocks every other page", () => {
	it("redirects away from the account page to the change-password form", async () => {
		stubAuthApi({ startAuthenticated: true, mustChangePassword: true });
		renderAt("/account");

		await screen.findByText("Indstil et nyt password");
		expect(screen.queryByText(/Nisserne har ikke trukket lod endnu/)).toBeNull();
	});

	it("redirects an admin away from the people-management page to the change-password form", async () => {
		const admin: Person = { ...PERSON, isAdmin: true };
		stubAuthApi({ person: admin, startAuthenticated: true, mustChangePassword: true });
		renderAt("/");

		await screen.findByText("Indstil et nyt password");
		expect(screen.queryByLabelText("Navn")).toBeNull();
	});

	it("bounces away from the change-password page once nothing is pending", async () => {
		stubAuthApi({ startAuthenticated: true, mustChangePassword: false });
		renderAt("/change-password");

		await screen.findByText(/Nisserne har ikke trukket lod endnu/);
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

		await screen.findByText("Indstil et nyt password");

		await user.type(screen.getByLabelText("Nuværende password"), "initial-pw");
		await user.type(screen.getByLabelText("Nyt password"), "a-brand-new-password");
		await user.type(screen.getByLabelText("Bekræft nyt password"), "a-brand-new-password");
		await user.click(screen.getByRole("button", { name: "Sæt nyt password" }));

		// Without the fix, RequireAuth would instead read the still-cached
		// mustChangePassword: true (the me-query refetch above never settles
		// to replace it) and redirect straight back to /change-password.
		await screen.findByText(/Nisserne har ikke trukket lod endnu/);
	});
});
