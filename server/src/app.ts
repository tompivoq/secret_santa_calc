import { Hono } from "hono";
import type { Db } from "./db/client.js";
import { getRoutes as getAuthRoutes } from "./auth/routes.js";
import { getRoutes as getPeopleRoutes } from "./people/routes.js";
import { getRoutes as getMatcherRoutes } from "./matcher/routes.js";
import { getRoutes as getMessageRoutes } from "./messages/routes.js";
import { getRoutes as getNoteRoutes } from "./notes/routes.js";
import { AuthVariables } from "./auth/types.js";
import { createLoggingMailer, type Mailer } from "./mail/mailer.js";

export interface AppOptions {
	/**
	 * How the app is reached from outside, used to build links in emails and
	 * to redirect back into the app afterwards. Absolute, because a link in
	 * an email has no page to be relative to — and because the app may be
	 * served under a path prefix, which a root-relative redirect would miss.
	 */
	appBaseUrl?: string;
	/** Defaults to one that logs rather than sends, so a test can never email anyone. */
	mailer?: Mailer;
}

/** Builds the Hono app against a given DB instance — a fresh instance per test keeps them isolated. */
export const createApp = (db: Db, authSecret: string, options: AppOptions = {}) => {
	const app = new Hono<{ Variables: AuthVariables }>();
	const appBaseUrl = (options.appBaseUrl ?? "").replace(/\/$/, "");
	const mailer = options.mailer ?? createLoggingMailer(() => {});

	// Deliberately no CORS grant: the frontend never needs one. In dev,
	// Vite's own proxy (see vite.config.ts) forwards /api server-side, so the
	// browser only ever talks to the Vite origin. In production, nginx
	// serves the frontend and proxies /api from the same origin. Every
	// legitimate request the browser makes is therefore same-origin already,
	// and the browser's default same-origin policy is exactly what should
	// block anyone else's page from reading these (cookie-authenticated)
	// responses — a permissive CORS policy here would hand that back out.

	const people = getPeopleRoutes(db, authSecret, { mailer, appBaseUrl });
	const auth = getAuthRoutes(db, authSecret, appBaseUrl);
	const matcher = getMatcherRoutes(db, authSecret, { mailer, appBaseUrl });

	app.route("/api/people", people);
	app.route("/api/auth", auth);
	app.route("/api/matcher", matcher);
	app.route("/api/messages", getMessageRoutes(db, authSecret, { mailer, appBaseUrl }));
	app.route("/api/notes", getNoteRoutes(db, authSecret));

	return app;
};
