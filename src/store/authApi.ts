import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Person } from "../models/person";

export interface LoginRequest {
	email: string;
	password: string;
}

export interface LoginResponse {
	person: Person;
	mustChangePassword: boolean;
}

export interface ChangePasswordRequest {
	/** Omitted when the server says it isn't needed — see `requiresCurrentPassword`. */
	currentPassword?: string;
	newPassword: string;
}

export interface MeResponse {
	person: Person;
	mustChangePassword: boolean;
	/**
	 * False for someone setting their first password after following an
	 * emailed login link: they've never had one to type in. The server
	 * decides this — the form just does as it's told.
	 */
	requiresCurrentPassword: boolean;
}

export const authApi = createApi({
	reducerPath: "authApi",
	// See peopleApi.ts for why this is resolved against window.location.origin
	// rather than left as a bare relative path.
	baseQuery: fetchBaseQuery({
		baseUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/api/auth`,
	}),
	tagTypes: ["Session"],
	endpoints: (builder) => ({
		// Whether anyone is logged in, and as whom — the source of truth the
		// rest of the app checks to decide between "show login", "force a
		// password change", and "show the signed-in view".
		me: builder.query<MeResponse, void>({
			query: () => "me",
			providesTags: ["Session"],
		}),
		login: builder.mutation<LoginResponse, LoginRequest>({
			query: (body) => ({ url: "login", method: "POST", body }),
			invalidatesTags: ["Session"],
		}),
		logout: builder.mutation<void, void>({
			query: () => ({ url: "logout", method: "POST" }),
			invalidatesTags: ["Session"],
		}),
		changePassword: builder.mutation<void, ChangePasswordRequest>({
			query: (body) => ({ url: "change-password", method: "POST", body }),
			invalidatesTags: ["Session"],
		}),
	}),
});

export const { useMeQuery, useLoginMutation, useLogoutMutation, useChangePasswordMutation } =
	authApi;
