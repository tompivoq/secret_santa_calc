/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { partnerSet, personAdded, personRemoved } from "./peopleSlice";
import { createStore } from "./store";

beforeEach(() => {
  localStorage.clear();
});

describe("store wiring", () => {
  it("starts empty when created with no preloaded people", () => {
    const store = createStore([]);
    expect(store.getState().people).toEqual([]);
  });

  it("adds a person via personAdded", () => {
    const store = createStore([]);
    store.dispatch(personAdded({ id: 0, name: "Bjørn", email: "bjorn@example.com" }));
    expect(store.getState().people).toEqual([{ id: 0, name: "Bjørn", email: "bjorn@example.com" }]);
  });

  it("reciprocally links partners set via partnerSet", () => {
    const store = createStore([
      { id: 0, name: "Bjørn", email: "bjorn@example.com" },
      { id: 1, name: "Anna", email: "anna@example.com" },
    ]);
    store.dispatch(partnerSet({ personId: 0, partnerId: 1 }));

    const people = store.getState().people;
    expect(people.find((p) => p.id === 0)?.partnerId).toBe(1);
    expect(people.find((p) => p.id === 1)?.partnerId).toBe(0);
  });

  it("removes a person via personRemoved", () => {
    const store = createStore([{ id: 0, name: "Bjørn", email: "bjorn@example.com" }]);
    store.dispatch(personRemoved(0));
    expect(store.getState().people).toEqual([]);
  });
});

describe("persistence across a simulated reload", () => {
  it("survives creating a fresh store that reads from localStorage, like a page reload would", () => {
    const firstSession = createStore([]);
    firstSession.dispatch(personAdded({ id: 0, name: "Bjørn", email: "bjorn@example.com" }));
    firstSession.dispatch(
      personAdded({ id: 1, name: "Anna", email: "anna@example.com", partnerId: 0 }),
    );

    // No preloaded people passed here, so this reads whatever the subscriber
    // above already persisted — simulating the user reopening the app.
    const secondSession = createStore();

    expect(secondSession.getState().people).toHaveLength(2);
    expect(secondSession.getState().people.find((p) => p.id === 1)?.partnerId).toBe(0);
  });
});
