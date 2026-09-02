import type { Person } from "../models/person";

const STORAGE_KEY = "secret-santa-calc:people";

/**
 * Reads the previously saved person list from localStorage. Returns an empty
 * list if nothing was saved yet, storage is unavailable (e.g. private
 * browsing), or the saved data is corrupt/unexpected shape — persistence is
 * best-effort and should never crash app startup.
 */
export const loadPeople = (): Person[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Person[]) : [];
  } catch {
    return [];
  }
};

/** Saves the current person list to localStorage. Failures are swallowed (best-effort). */
export const savePeople = (people: Person[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
  } catch {
    // Storage can be unavailable or full — persistence is best-effort, not critical.
  }
};
