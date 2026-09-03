/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { Person } from "../models/person";
import { loadPeople, savePeople } from "./persistence";

const bjorn: Person = { id: 0, name: "Bjørn", email: "bjorn@example.com", phone: 22334455 };
const anna: Person = {
  id: 1,
  name: "Anna",
  email: "anna@example.com",
  phone: 87654321,
  partnerId: 0,
};

beforeEach(() => {
  localStorage.clear();
});

describe("loadPeople", () => {
  it("returns an empty list when nothing was saved", () => {
    expect(loadPeople()).toEqual([]);
  });

  it("returns an empty list when the saved data is corrupt JSON", () => {
    localStorage.setItem("secret-santa-calc:people", "{not valid json");
    expect(loadPeople()).toEqual([]);
  });

  it("returns an empty list when the saved data is not an array", () => {
    localStorage.setItem("secret-santa-calc:people", JSON.stringify({ oops: true }));
    expect(loadPeople()).toEqual([]);
  });
});

describe("savePeople / loadPeople round trip", () => {
  it("saves and reloads the exact person list, including partner links", () => {
    savePeople([bjorn, anna]);
    expect(loadPeople()).toEqual([bjorn, anna]);
  });

  it("round-trips an empty list", () => {
    savePeople([bjorn]);
    savePeople([]);
    expect(loadPeople()).toEqual([]);
  });
});
