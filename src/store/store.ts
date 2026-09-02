import { configureStore } from "@reduxjs/toolkit";
import type { Person } from "../models/person";
import peopleReducer from "./peopleSlice";
import { loadPeople, savePeople } from "./persistence";

/**
 * Creates a store instance. Defaults to hydrating from localStorage so the
 * app resumes where the user left off; pass an explicit `preloadedPeople`
 * (e.g. `[]` in tests) to skip that and start clean.
 */
export const createStore = (preloadedPeople: Person[] = loadPeople()) => {
  const store = configureStore({
    reducer: {
      people: peopleReducer,
    },
    preloadedState: {
      people: preloadedPeople,
    },
  });

  store.subscribe(() => {
    savePeople(store.getState().people);
  });

  return store;
};

export const store = createStore();

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
