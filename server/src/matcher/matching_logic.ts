import { PersonRow } from "../db/schema.js";

interface MatchingPerson extends PersonRow {
    hasMatch: boolean;
    currentTarget?: number | null;
}

export const doMatching = (people: MatchingPerson[]): MatchingPerson[] => {
    return people;
}