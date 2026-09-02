import { describe, expect, it } from "vite-plus/test";
import type { Person } from "../models/person";
import { findPartner, removePerson } from "./person_utils";

const makePerson = (id: number, partnerId?: number): Person => ({
  id,
  name: `Person ${id}`,
  email: `person${id}@example.com`,
  partnerId,
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
