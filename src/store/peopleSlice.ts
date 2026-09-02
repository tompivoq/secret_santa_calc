import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Person } from "../models/person";
import { removePerson } from "../utils/person_utils";
import { findPersonById } from "./selectors";

/**
 * Reciprocally links (or unlinks, when `partnerId` is `null`) two people
 * within an Immer draft. Whoever the two were previously partnered with, if
 * anyone, is unlinked too, so no one is left pointing at a partner who no
 * longer points back. Mutates the draft in place — used by both
 * `personAdded` (linking a partner chosen at creation time) and
 * `partnerSet`.
 */
const linkPartner = (state: Person[], personId: number, partnerId: number | null) => {
  const person = findPersonById(state, personId);
  if (!person || partnerId === personId) {
    return;
  }

  const newPartner = partnerId === null ? undefined : findPersonById(state, partnerId);
  if (partnerId !== null && !newPartner) {
    return;
  }

  const previousPartner =
    person.partnerId !== undefined ? findPersonById(state, person.partnerId) : undefined;
  const newPartnersPreviousPartner =
    newPartner?.partnerId !== undefined ? findPersonById(state, newPartner.partnerId) : undefined;

  if (previousPartner) {
    previousPartner.partnerId = undefined;
  }
  if (newPartnersPreviousPartner) {
    newPartnersPreviousPartner.partnerId = undefined;
  }
  person.partnerId = newPartner?.id;
  if (newPartner) {
    newPartner.partnerId = person.id;
  }
};

const peopleSlice = createSlice({
  name: "people",
  initialState: [] as Person[],
  reducers: {
    /** Adds a person. If they were created with a partner selected, links that partner back reciprocally. */
    personAdded: (state, action: PayloadAction<Person>) => {
      state.push(action.payload);
      if (action.payload.partnerId !== undefined) {
        linkPartner(state, action.payload.id, action.payload.partnerId);
      }
    },
    /** Removes a person, clearing the reciprocal link on their former partner, if any. */
    personRemoved: (state, action: PayloadAction<number>) => removePerson(state, action.payload),
    /** Sets (or clears, with `partnerId: null`) the reciprocal partner link for a person. */
    partnerSet: (state, action: PayloadAction<{ personId: number; partnerId: number | null }>) => {
      linkPartner(state, action.payload.personId, action.payload.partnerId);
    },
  },
});

export const { personAdded, personRemoved, partnerSet } = peopleSlice.actions;
export default peopleSlice.reducer;
