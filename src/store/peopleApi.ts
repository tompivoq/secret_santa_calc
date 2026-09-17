import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Person } from "../models/person";

export interface NewPerson {
	name: string;
	email: string;
	phone: number;
	partnerId?: number | null;
}

/** Any subset of a person's editable fields — everything the edit form can change. */
export interface PersonUpdate {
	name?: string;
	email?: string;
	phone?: number;
	partnerId?: number | null;
	lastYearRecipientId?: number | null;
}

export interface CreatedPerson extends Person {
	/** Shown once, in the response to the create call — never retrievable afterwards. */
	initialPassword: string;
}

export interface InviteRequest {
	/** Omitted invites everyone still waiting for one; naming people re-sends to those. */
	personIds?: number[];
}

export interface InviteResult {
	invited: { personId: number; name: string }[];
	/** Per person: one bad address doesn't stop the rest going out. */
	failed: { personId: number; name: string; error: string }[];
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
		// One request for the whole edit form — the server applies the lot in
		// a single transaction, so a bad partner can't half-apply a rename.
		updatePerson: builder.mutation<Person, { id: number } & PersonUpdate>({
			query: ({ id, ...body }) => ({ url: `people/${id}`, method: "PATCH", body }),
			invalidatesTags: ["People"],
		}),
		// Refetches the list afterwards, since that's where invitedAt is shown.
		invitePeople: builder.mutation<InviteResult, InviteRequest>({
			query: (body) => ({ url: "people/invite", method: "POST", body }),
			invalidatesTags: ["People"],
		}),
	}),
});

export const {
	useGetPeopleQuery,
	useAddPersonMutation,
	useRemovePersonMutation,
	useUpdatePersonMutation,
	useInvitePeopleMutation,
} = peopleApi;
