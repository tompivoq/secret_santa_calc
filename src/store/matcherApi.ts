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
	/** Whether the pairings are withheld from the admin — see `assignments`. */
	blind: boolean;
	/** Who took part. Always present, even when the pairings aren't. */
	participantIds: number[];
	/** Who has been emailed their link. Safe to know even for a blind draw. */
	notifiedIds: number[];
	/**
	 * Absent for a blind draw, and absent from the response itself rather
	 * than merely unrendered — there's nothing here to reveal.
	 */
	assignments?: Assignment[];
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
	/** Withhold the pairings from the admin too. Defaults to true server-side. */
	blind?: boolean;
}

export interface NotifyRequest {
	/** Omitted emails everyone not yet told; naming people re-sends to those. */
	personIds?: number[];
}

export interface NotifyResult {
	notified: { personId: number; name: string }[];
	/** Per person: one bad address doesn't stop the rest going out. */
	failed: { personId: number; name: string; error: string }[];
}

export interface MyMatch {
	/** Null until a draw has been locked in that this person was part of. */
	recipient: { id: number; name: string } | null;
	drawnAt?: string;
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
		notify: builder.mutation<NotifyResult, NotifyRequest>({
			query: (body) => ({ url: "notify", method: "POST", body }),
			invalidatesTags: ["Draw"],
		}),
		// The signed-in person's own match. Tagged alongside the admin's view
		// so that locking a draw in refreshes this too, rather than leaving an
		// admin who's also a participant looking at a stale "not matched yet".
		myMatch: builder.query<MyMatch, void>({
			query: () => "mine",
			providesTags: ["Draw"],
		}),
	}),
});

export const {
	useCurrentDrawQuery,
	useDraftMutation,
	useLockDrawMutation,
	useNotifyMutation,
	useMyMatchQuery,
} = matcherApi;
