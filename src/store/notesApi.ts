import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { JSONContent } from "@tiptap/react";

export interface Note {
	/** The editor's JSON document. Null until the first save. */
	content: JSONContent | null;
	/** 0 before the first save; the server bumps it with every save. */
	version: number;
	updatedAt: string | null;
}

export interface SaveNoteRequest {
	content: JSONContent;
	/** The version this edit started from — see the 409 handling in NotesEditor. */
	baseVersion: number;
}

export interface SaveNoteResponse {
	version: number;
	updatedAt: string;
}

export const notesApi = createApi({
	reducerPath: "notesApi",
	// See peopleApi.ts for why this is resolved against window.location.origin
	// rather than left as a bare relative path.
	baseQuery: fetchBaseQuery({
		baseUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/api/notes`,
	}),
	endpoints: (builder) => ({
		note: builder.query<Note, void>({
			query: () => "",
		}),
		saveNote: builder.mutation<SaveNoteResponse, SaveNoteRequest>({
			query: (body) => ({ url: "", method: "PUT", body }),
			// Keep the cached note in step with what was just saved, rather than
			// refetching: a refetch mid-typing would race the editor. This way,
			// coming back to the page starts from the saved version, not the one
			// first loaded — which would otherwise be refused as out of date.
			async onQueryStarted({ content }, { dispatch, queryFulfilled }) {
				try {
					const { data } = await queryFulfilled;
					dispatch(
						notesApi.util.updateQueryData("note", undefined, (draft) => {
							draft.content = content;
							draft.version = data.version;
							draft.updatedAt = data.updatedAt;
						}),
					);
				} catch {
					// The editor handles failures and conflicts itself.
				}
			},
		}),
	}),
});

export const { useNoteQuery, useSaveNoteMutation } = notesApi;
