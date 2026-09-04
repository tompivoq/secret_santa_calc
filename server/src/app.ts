import { Hono } from "hono";
import type { Db } from "./db/client.js";
import { getRoutes as getAuthRoutes } from "./auth/routes.js";
import { getRoutes as getPeopleRoutes } from "./people/routes.js";
import { getRoutes as getMatcherRoutes } from "./matcher/routes.js";
import { AuthVariables } from "./auth/types.js";

/** Builds the Hono app against a given DB instance — a fresh instance per test keeps them isolated. */
export const createApp = (db: Db, authSecret: string) => {
	const app = new Hono<{ Variables: AuthVariables }>();

	// Deliberately no CORS grant: the frontend never needs one. In dev,
	// Vite's own proxy (see vite.config.ts) forwards /api server-side, so the
	// browser only ever talks to the Vite origin. In production, nginx
	// serves the frontend and proxies /api from the same origin. Every
	// legitimate request the browser makes is therefore same-origin already,
	// and the browser's default same-origin policy is exactly what should
	// block anyone else's page from reading these (cookie-authenticated)
	// responses — a permissive CORS policy here would hand that back out.

	const people = getPeopleRoutes(db, authSecret);
	const auth = getAuthRoutes(db, authSecret);
	const matcher = getMatcherRoutes(db, authSecret);

	app.route("/api/people", people);
	app.route("/api/auth", auth);
	app.route("/api/matcher", matcher);

	return app;
};
