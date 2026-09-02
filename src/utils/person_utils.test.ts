import { describe, expect, it } from "vite-plus/test";
import type { Person } from "../models/person";
import { findPartner, getNextId, removePerson } from "./person_utils";

const makePerson = (id: number, partnerId?: number): Person => ({
  id,
  name: `Person ${id}`,
  email: `person${id}@example.com`,
  partnerId,
});

describe("getNextId", () => {
  it("returns 0 for an empty list", () => {
    expect(getNextId([])).toBe(0);
  });

  it("returns one more than the highest existing id", () => {
    const people = [makePerson(0), makePerson(3), makePerson(1)];
    expect(getNextId(people)).toBe(4);
  });

  it("works when the list has a single person", () => {
    expect(getNextId([makePerson(5)])).toBe(6);
  });

  it("returns 1 when the only existing id is 0 (id 0 is falsy, not absent)", () => {
    expect(getNextId([makePerson(0)])).toBe(1);
  });

  it("does not mutate the list it is given", () => {
    const people = [makePerson(0), makePerson(3), makePerson(1)];
    const original = [...people];
    getNextId(people);
    expect(people).toEqual(original);
  });
});

describe("findPartner", () => {
  it("returns undefined when the person has no partner", () => {
    const people = [makePerson(0)];
    expect(findPartner(people, people[0])).toBeUndefined();
  });

  it("returns the partner referenced by partnerId", () => {
    const people = [makePerson(0, 1), makePerson(1, 0)];
    expect(findPartner(people, people[0])?.id).toBe(1);
  });

  it("returns undefined when the person has a partner that does not exist", () => {
    const people = [makePerson(0, 1)];
    expect(findPartner(people, people[0])).toBeUndefined();
  });
});

describe("removePerson", () => {
  it("removes the person from the list", () => {
    const people = [makePerson(0), makePerson(1)];
    const result = removePerson(people, 0);

    expect(result).toHaveLength(1);
    expect(result.find((p) => p.id === 0)).toBeUndefined();
  });

  it("clears the removed person's partner link on their former partner", () => {
    const people = [makePerson(0, 1), makePerson(1, 0)];
    const result = removePerson(people, 0);

    expect(result.find((p) => p.id === 1)?.partnerId).toBeUndefined();
  });
});
