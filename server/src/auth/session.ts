import { sign, verify } from "hono/jwt";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

const COOKIE_NAME = "session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
	[key: string]: unknown;
	personId: number;
	exp: number;
	purpose?: string;
	/**
	 * Whether this session was started by following an emailed login link,
	 * rather than by typing a password. It's what lets someone who has never
	 * had a password of their own set one without being asked for the
	 * current one — they proved control of their email address instead.
	 */
	viaMagicLink?: boolean;
}

export interface Session {
	personId: number;
	viaMagicLink: boolean;
}

/**
 * Magic-link tokens are signed with this same secret and also carry a
 * personId, so without saying what a token is *for*, one could simply be
 * pasted in as a session cookie — logging in while leaving the link
 * unconsumed and therefore still reusable. Tokens issued before this
 * claim existed have no purpose at all, and stay valid as sessions.
 */
const SESSION_PURPOSE = "session";

/**
 * Whether the browser reached the app over HTTPS. nginx proxies to the API
 * over plain HTTP whichever way the request arrived, so the original
 * scheme only survives in the forwarded header the proxy sets — the direct
 * URL always looks like http:// from in here.
 *
 * A client could of course send that header itself, but only to ask for a
 * Secure cookie on a connection that can't return one, which breaks
 * nothing but their own login.
 */
const isHttps = (c: Context): boolean =>
	c.req.header("x-forwarded-proto") === "https" || new URL(c.req.url).protocol === "https:";

/** Issues a session for `personId` and sets it as an httpOnly cookie on the response. */
export const createSession = async (
	c: Context,
	personId: number,
	secret: string,
	options: { viaMagicLink?: boolean } = {},
): Promise<void> => {
	const payload: SessionPayload = {
		personId,
		purpose: SESSION_PURPOSE,
		...(options.viaMagicLink && { viaMagicLink: true }),
		exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
	};
	const token = await sign(payload, secret, "HS256");

	setCookie(c, COOKIE_NAME, token, {
		httpOnly: true,
		sameSite: "Lax",
		// Decided per request rather than once: the app answers both on the
		// public HTTPS subdomain and on plain HTTP on the LAN. Always setting
		// it would silently break login on the LAN — the browser would simply
		// never send the cookie back — and never setting it would leave the
		// public site's sessions liable to be sent in clear on a downgrade.
		secure: isHttps(c),
		path: "/",
		maxAge: SESSION_LIFETIME_SECONDS,
	});
};

/** Reads and verifies the session cookie on a request, if any. Returns the session, or null. */
export const readSession = async (c: Context, secret: string): Promise<Session | null> => {
	const token = getCookie(c, COOKIE_NAME);
	if (!token) {
		return null;
	}

	try {
		const payload = (await verify(token, secret, "HS256")) as unknown as SessionPayload;
		if (payload.purpose !== undefined && payload.purpose !== SESSION_PURPOSE) {
			return null;
		}
		return { personId: payload.personId, viaMagicLink: payload.viaMagicLink === true };
	} catch {
		return null;
	}
};

export const clearSession = (c: Context): void => {
	deleteCookie(c, COOKIE_NAME, { path: "/" });
};
