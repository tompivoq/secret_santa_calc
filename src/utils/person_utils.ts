import type { Person } from "../models/person";
import { find } from "lodash-es";

export const findPartner = (people: Person[], person: Person): Person | undefined =>
  find(people, { id: person.partnerId });

/** Removes a person from the list, clearing the reciprocal link on their former partner, if any. */
export const removePerson = (people: Person[], personId: number): Person[] =>
  people
    .filter((person) => person.id !== personId)
    .map((person) =>
      person.partnerId === personId ? { ...person, partnerId: undefined } : person,
    );
