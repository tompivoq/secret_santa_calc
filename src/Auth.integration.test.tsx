/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
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
}: StubAuthApiOptions = {}) => {
  const state = { password, mustChangePassword: true, authenticated: startAuthenticated };

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
});

describe("admin access to the people-management page", () => {
  it("shows a 'no access' message to a logged-in non-admin who visits it directly", async () => {
    stubAuthApi({ startAuthenticated: true });
    renderAt("/");

    await screen.findByText("You don't have access to this page.");
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("shows the page, and the nav link, to a logged-in admin", async () => {
    const admin: Person = { ...PERSON, isAdmin: true };
    stubAuthApi({ person: admin, startAuthenticated: true });
    renderAt("/");

    await screen.findByLabelText("Name");
    expect(screen.getByRole("link", { name: "Manage people" })).not.toBeNull();
  });
});
