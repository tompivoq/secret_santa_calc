import type { Person } from "../models/person"
import { find, maxBy } from "lodash-es";

export const getNextId = (list: Person[]): number =>
    (maxBy(list, 'id')?.id ?? -1) + 1;

export const findPartner = (people: Person[], person: Person): Person | undefined =>
    find(people, {id: person.partnerId});

/**
 * Sets (or clears, when partnerId is null) the reciprocal partner link between
 * two people. Whoever the two were previously partnered with, if anyone, is
 * unlinked so no one is left pointing at a partner who no longer points back.
 */
export const setPartner = (people: Person[], personId: number, partnerId: number | null): Person[] => {
    const byId = new Map(people.map((person) => [person.id, person]));
    const person = byId.get(personId);
    if (!person || partnerId === personId) {
        return people;
    }

    const newPartner = partnerId === null ? undefined : byId.get(partnerId);
    if (partnerId !== null && !newPartner) {
        return people;
    }

    const previousPartner = person.partnerId !== undefined ? byId.get(person.partnerId) : undefined;
    const newPartnersPreviousPartner =
        newPartner?.partnerId !== undefined ? byId.get(newPartner.partnerId) : undefined;

    const updates = new Map<number, Person>();
    if (previousPartner) {
        updates.set(previousPartner.id, { ...previousPartner, partnerId: undefined });
    }
    if (newPartnersPreviousPartner) {
        updates.set(newPartnersPreviousPartner.id, { ...newPartnersPreviousPartner, partnerId: undefined });
    }
    updates.set(person.id, { ...person, partnerId: newPartner?.id });
    if (newPartner) {
        updates.set(newPartner.id, { ...newPartner, partnerId: person.id });
    }

    return people.map((p) => updates.get(p.id) ?? p);
};

/** Removes a person from the list, clearing the reciprocal link on their former partner, if any. */
export const removePerson = (people: Person[], personId: number): Person[] =>
    people
        .filter((person) => person.id !== personId)
        .map((person) => (person.partnerId === personId ? { ...person, partnerId: undefined } : person));
