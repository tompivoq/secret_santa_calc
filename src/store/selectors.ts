import { createSelector } from "@reduxjs/toolkit";
import { find, maxBy } from "lodash-es";
import type { Person } from "../models/person";
import type { RootState } from "./store";

/**
 * Finds a person by id within a given list. This is the shared lookup
 * behind the RootState-facing selectors below (for use in components), and
 * is also used directly inside the `people` reducer — a reducer's local
 * state IS the person list already, with no RootState to select from.
 */
export const findPersonById = (people: Person[], personId: number): Person | undefined =>
  find(people, { id: personId });

export const selectAllPeople = (state: RootState) => state.people;

export const selectPersonById = (personId: number) =>
  createSelector(selectAllPeople, (allPeople) => findPersonById(allPeople, personId));

export const selectMaxPersonId = createSelector(
  selectAllPeople,
  (allPeople) => maxBy(allPeople, "id")?.id,
);
