import { configureStore } from "@reduxjs/toolkit";
import { peopleApi } from "./peopleApi";
import { authApi } from "./authApi";
import { matcherApi } from "./matcherApi";

/**
 * Creates a store instance. The app uses one singleton; tests create their
 * own so RTK Query's cache (and any in-flight requests) don't leak between
 * tests.
 */
export const createStore = () =>
	configureStore({
		reducer: {
			[peopleApi.reducerPath]: peopleApi.reducer,
			[authApi.reducerPath]: authApi.reducer,
			[matcherApi.reducerPath]: matcherApi.reducer,
		},
		middleware: (getDefaultMiddleware) =>
			getDefaultMiddleware().concat(
				peopleApi.middleware,
				authApi.middleware,
				matcherApi.middleware,
			),
	});

export const store = createStore();

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
