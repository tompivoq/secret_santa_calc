import { describe, expect, it } from "vite-plus/test";
import type { Person } from "../models/person";
import peopleReducer, { partnerSet, personAdded, personRemoved } from "./peopleSlice";

const makePerson = (id: number, partnerId?: number): Person => ({
  id,
  name: `Person ${id}`,
  email: `person${id}@example.com`,
  phone: 22334455,
  partnerId,
});

describe("personAdded", () => {
  it("appends the person", () => {
    const state = peopleReducer([makePerson(0)], personAdded(makePerson(1)));
    expect(state).toEqual([makePerson(0), makePerson(1)]);
  });

  it("reciprocally links the partner chosen at creation time", () => {
    const state = peopleReducer([makePerson(0)], personAdded(makePerson(1, 0)));

    expect(state.find((p) => p.id === 0)?.partnerId).toBe(1);
    expect(state.find((p) => p.id === 1)?.partnerId).toBe(0);
  });

  it("unlinks the chosen partner's previous partner", () => {
    // Bjørn (0) & Carl (2) are partnered; Anna (1) is created partnered with Bjørn.
    const state = peopleReducer(
      [makePerson(0, 2), makePerson(2, 0)],
      personAdded(makePerson(1, 0)),
    );

    expect(state.find((p) => p.id === 0)?.partnerId).toBe(1);
    expect(state.find((p) => p.id === 1)?.partnerId).toBe(0);
    expect(state.find((p) => p.id === 2)?.partnerId).toBeUndefined();
  });
});

describe("partnerSet", () => {
  it("links two people reciprocally", () => {
    const state = peopleReducer(
      [makePerson(0), makePerson(1)],
      partnerSet({ personId: 0, partnerId: 1 }),
    );

    expect(state.find((p) => p.id === 0)?.partnerId).toBe(1);
    expect(state.find((p) => p.id === 1)?.partnerId).toBe(0);
  });

  it("clears the partner when partnerId is null", () => {
    const state = peopleReducer(
      [makePerson(0, 1), makePerson(1, 0)],
      partnerSet({ personId: 0, partnerId: null }),
    );

    expect(state.find((p) => p.id === 0)?.partnerId).toBeUndefined();
    expect(state.find((p) => p.id === 1)?.partnerId).toBeUndefined();
  });

  it("unlinks the previous partner when switching to a new one", () => {
    // Anna (0) & Bjørn (1) are partnered; Carl (2) is unpartnered.
    const state = peopleReducer(
      [makePerson(0, 1), makePerson(1, 0), makePerson(2)],
      partnerSet({ personId: 0, partnerId: 2 }),
    );

    expect(state.find((p) => p.id === 0)?.partnerId).toBe(2);
    expect(state.find((p) => p.id === 2)?.partnerId).toBe(0);
    expect(state.find((p) => p.id === 1)?.partnerId).toBeUndefined();
  });

  it("unlinks the new partner from their previous partner too", () => {
    // Anna (0) & Bjørn (1) are partnered; Carl (2) & Dana (3) are partnered.
    // Anna now partners with Carl.
    const state = peopleReducer(
      [makePerson(0, 1), makePerson(1, 0), makePerson(2, 3), makePerson(3, 2)],
      partnerSet({ personId: 0, partnerId: 2 }),
    );

    expect(state.find((p) => p.id === 0)?.partnerId).toBe(2);
    expect(state.find((p) => p.id === 2)?.partnerId).toBe(0);
    expect(state.find((p) => p.id === 1)?.partnerId).toBeUndefined();
    expect(state.find((p) => p.id === 3)?.partnerId).toBeUndefined();
  });

  it("is a no-op when the person does not exist", () => {
    const initial = [makePerson(0)];
    const state = peopleReducer(initial, partnerSet({ personId: 99, partnerId: 0 }));
    expect(state).toEqual(initial);
  });

  it("is a no-op when trying to partner a person with themselves", () => {
    const initial = [makePerson(0)];
    const state = peopleReducer(initial, partnerSet({ personId: 0, partnerId: 0 }));
    expect(state).toEqual(initial);
  });
});

describe("personRemoved", () => {
  it("removes the person from the list", () => {
    const state = peopleReducer([makePerson(0), makePerson(1)], personRemoved(0));

    expect(state).toHaveLength(1);
    expect(state.find((p) => p.id === 0)).toBeUndefined();
  });

  it("clears the removed person's partner link on their former partner", () => {
    const state = peopleReducer([makePerson(0, 1), makePerson(1, 0)], personRemoved(0));
    expect(state.find((p) => p.id === 1)?.partnerId).toBeUndefined();
  });
});
