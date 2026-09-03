import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Person } from "../models/person";

export interface NewPerson {
  name: string;
  email: string;
  phone: number;
  partnerId?: number | null;
}

export interface CreatedPerson extends Person {
  /** Shown once, in the response to the create call — never retrievable afterwards. */
  initialPassword: string;
}

export const peopleApi = createApi({
  reducerPath: "peopleApi",
  // Resolved against the current origin rather than left as a bare "/api":
  // Node's fetch (unlike a real browser) has no document to resolve a
  // relative URL against, so RTK Query's internal Request construction
  // throws on one in tests. Same-origin either way in the browser, so this
  // changes nothing about how it behaves once deployed.
  baseQuery: fetchBaseQuery({
    baseUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/api`,
  }),
  tagTypes: ["People"],
  endpoints: (builder) => ({
    getPeople: builder.query<Person[], void>({
      query: () => "people",
      providesTags: ["People"],
    }),
    addPerson: builder.mutation<CreatedPerson, NewPerson>({
      query: (body) => ({ url: "people", method: "POST", body }),
      invalidatesTags: ["People"],
    }),
    removePerson: builder.mutation<void, number>({
      query: (id) => ({ url: `people/${id}`, method: "DELETE" }),
      invalidatesTags: ["People"],
    }),
    setPartner: builder.mutation<void, { personId: number; partnerId: number | null }>({
      query: ({ personId, partnerId }) => ({
        url: `people/${personId}/partner`,
        method: "PUT",
        body: { partnerId },
      }),
      invalidatesTags: ["People"],
    }),
  }),
});

export const {
  useGetPeopleQuery,
  useAddPersonMutation,
  useRemovePersonMutation,
  useSetPartnerMutation,
} = peopleApi;
