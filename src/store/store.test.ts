/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { personAdded } from "./peopleSlice";
import { createStore } from "./store";

beforeEach(() => {
  localStorage.clear();
});

describe("store wiring", () => {
  it("starts empty when created with no preloaded people", () => {
    const store = createStore([]);
    expect(store.getState().people).toEqual([]);
  });

  it("routes a dispatched action through the configured people reducer", () => {
    const store = createStore([]);
    store.dispatch(
      personAdded({ id: 0, name: "Bjørn", email: "bjorn@example.com", phone: 22334455 }),
    );
    expect(store.getState().people).toEqual([
      { id: 0, name: "Bjørn", email: "bjorn@example.com", phone: 22334455 },
    ]);
  });
});

describe("persistence across a simulated reload", () => {
  it("survives creating a fresh store that reads from localStorage, like a page reload would", () => {
    const firstSession = createStore([]);
    firstSession.dispatch(
      personAdded({ id: 0, name: "Bjørn", email: "bjorn@example.com", phone: 22334455 }),
    );
    firstSession.dispatch(
      personAdded({
        id: 1,
        name: "Anna",
        email: "anna@example.com",
        phone: 87654321,
        partnerId: 0,
      }),
    );

    // No preloaded people passed here, so this reads whatever the subscriber
    // above already persisted — simulating the user reopening the app.
    const secondSession = createStore();

    expect(secondSession.getState().people).toHaveLength(2);
    expect(secondSession.getState().people.find((p) => p.id === 1)?.partnerId).toBe(0);
  });
});
