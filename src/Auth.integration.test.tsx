/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, it, vi } from "vite-plus/test";
import App from "./App";
import { createStore } from "./store/store";
import type { Person } from "./models/person";

const PERSON: Person = { id: 1, name: "Bjørn", email: "bjorn@example.com", phone: 11223344 };

/**
 * Stubs `fetch` with a small stateful fake of the auth API: one seeded
 * person with a known initial password, a `mustChangePassword` flag, and a
 * boolean standing in for "has a valid session cookie" (real cookie
 * handling isn't exercised here — that's covered by the server's own tests
 * against the real HTTP layer).
 */
const stubAuthApi = (initialPassword = "initial-pw") => {
  const state = { password: initialPassword, mustChangePassword: true, authenticated: false };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        const { email, password } = (await request.json()) as { email: string; password: string };
        if (email !== PERSON.email || password !== state.password) {
          return new Response(JSON.stringify({ error: "Invalid email or password" }), {
            status: 401,
          });
        }
        state.authenticated = true;
        return new Response(
          JSON.stringify({ person: PERSON, mustChangePassword: state.mustChangePassword }),
          { status: 200 },
        );
      }

      if (url.pathname === "/api/auth/me" && request.method === "GET") {
        if (!state.authenticated) {
          return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
        }
        return new Response(
          JSON.stringify({ person: PERSON, mustChangePassword: state.mustChangePassword }),
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
    stubAuthApi("initial-pw");
    const user = userEvent.setup();
    renderAt("/login");

    await user.type(screen.getByLabelText("Email"), PERSON.email);
    await user.type(screen.getByLabelText("Password"), "initial-pw");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await screen.findByText("This is your first time logging in — please set a new password.");

    await user.type(screen.getByLabelText("Current password"), "initial-pw");
    await user.type(screen.getByLabelText("New password"), "a-brand-new-password");
    await user.type(screen.getByLabelText("Confirm new password"), "a-brand-new-password");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    await screen.findByText("You haven't been matched yet — check back after the draw.");
  });

  it("shows an error and stays on the login page for the wrong password", async () => {
    stubAuthApi("initial-pw");
    const user = userEvent.setup();
    renderAt("/login");

    await user.type(screen.getByLabelText("Email"), PERSON.email);
    await user.type(screen.getByLabelText("Password"), "the-wrong-password");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    await screen.findByText("Incorrect email or password");
  });
});
