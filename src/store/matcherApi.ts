import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Person } from "../models/person";

export interface MatchResult extends Person {
	hasMatch: boolean;
	currentTarget: number | null;
}

export const matcherApi = createApi({
	reducerPath: "matcherApi",
	// See peopleApi.ts for why this is resolved against window.location.origin
	// rather than left as a bare relative path.
	baseQuery: fetchBaseQuery({
		baseUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/api/matcher`,
	}),
	endpoints: (builder) => ({
		// Preview-only: the server computes and returns a valid assignment
		// without persisting anything, so calling this is inherently a dry
		// run. There's no separate "commit" endpoint yet — see TODO.md.
		runMatch: builder.mutation<MatchResult[], number[]>({
			query: (personIds) => ({ url: "", method: "POST", body: { personIds } }),
		}),
	}),
});

export const { useRunMatchMutation } = matcherApi;
