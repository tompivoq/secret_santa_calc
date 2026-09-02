import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Person } from "../models/person";
import { removePerson, setPartner } from "../utils/person_utils";

const peopleSlice = createSlice({
  name: "people",
  initialState: [] as Person[],
  reducers: {
    /** Adds a person. If they were created with a partner selected, links that partner back reciprocally. */
    personAdded: (state, action: PayloadAction<Person>) => {
      const person = action.payload;
      const withNewPerson = [...state, person];
      return person.partnerId === undefined
        ? withNewPerson
        : setPartner(withNewPerson, person.id, person.partnerId);
    },
    /** Removes a person, clearing the reciprocal link on their former partner, if any. */
    personRemoved: (state, action: PayloadAction<number>) => removePerson(state, action.payload),
    /** Sets (or clears, with `partnerId: null`) the reciprocal partner link for a person. */
    partnerSet: (state, action: PayloadAction<{ personId: number; partnerId: number | null }>) =>
      setPartner(state, action.payload.personId, action.payload.partnerId),
  },
});

export const { personAdded, personRemoved, partnerSet } = peopleSlice.actions;
export default peopleSlice.reducer;
