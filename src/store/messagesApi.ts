import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/** A question you asked. You chose whom, so that's shown. */
export interface SentQuestion {
	id: number;
	to: { id: number; name: string };
	question: string;
	askedAt: string;
	answer: string | null;
	answeredAt: string | null;
}

/**
 * A question you were asked. There is no sender here, nor whether it was
 * about you or your partner — the server never sends either.
 */
export interface ReceivedQuestion {
	id: number;
	question: string;
	askedAt: string;
	answer: string | null;
	answeredAt: string | null;
}

export interface Inbox {
	/** False until the draw is locked in. */
	open: boolean;
	/** Your recipient, and their partner if they have one. */
	canAsk: { id: number; name: string }[];
	sent: SentQuestion[];
	received: ReceivedQuestion[];
}

export const messagesApi = createApi({
	reducerPath: "messagesApi",
	// See peopleApi.ts for why this is resolved against window.location.origin
	// rather than left as a bare relative path.
	baseQuery: fetchBaseQuery({
		baseUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/api/messages`,
	}),
	tagTypes: ["Messages"],
	endpoints: (builder) => ({
		inbox: builder.query<Inbox | null, void>({
			query: () => "",
			providesTags: ["Messages"],
		}),
		ask: builder.mutation<
			SentQuestion & { emailed: boolean },
			{ recipientId: number; question: string }
		>({
			query: (body) => ({ url: "", method: "POST", body }),
			invalidatesTags: ["Messages"],
		}),
		answer: builder.mutation<
			ReceivedQuestion & { emailed: boolean },
			{ id: number; answer: string }
		>({
			query: ({ id, answer }) => ({ url: `${id}/answer`, method: "POST", body: { answer } }),
			invalidatesTags: ["Messages"],
		}),
	}),
});

export const { useInboxQuery, useAskMutation, useAnswerMutation } = messagesApi;
