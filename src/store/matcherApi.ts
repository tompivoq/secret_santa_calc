import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export interface Assignment {
	id: number;
	drawId: number;
	giverId: number;
	recipientId: number;
}

export interface Draw {
	id: number;
	createdAt: string;
	/** Null while this is still a draft the admin can re-roll. */
	lockedAt: string | null;
	assignments: Assignment[];
}

export interface DraftResult {
	draw: Draw;
	/** True when last year's pairings had to be allowed to find any valid match. */
	repeatedLastYear: boolean;
}

export interface DraftRequest {
	personIds: number[];
	/** Required to draw again once a draw is locked in — see the matcher routes. */
	startOver?: boolean;
}

export const matcherApi = createApi({
	reducerPath: "matcherApi",
	// See peopleApi.ts for why this is resolved against window.location.origin
	// rather than left as a bare relative path.
	baseQuery: fetchBaseQuery({
		baseUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/api/matcher`,
	}),
	tagTypes: ["Draw"],
	endpoints: (builder) => ({
		// The draw the admin is currently working on — a draft if one is in
		// progress, otherwise the locked result. Null before the first draw.
		currentDraw: builder.query<Draw | null, void>({
			query: () => "current",
			providesTags: ["Draw"],
		}),
		draft: builder.mutation<DraftResult, DraftRequest>({
			query: (body) => ({ url: "draft", method: "POST", body }),
			invalidatesTags: ["Draw"],
		}),
		lockDraw: builder.mutation<Draw, void>({
			query: () => ({ url: "lock", method: "POST" }),
			invalidatesTags: ["Draw"],
		}),
	}),
});

export const { useCurrentDrawQuery, useDraftMutation, useLockDrawMutation } = matcherApi;
