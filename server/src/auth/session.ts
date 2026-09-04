import { sign, verify } from "hono/jwt";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

const COOKIE_NAME = "session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
	[key: string]: unknown;
	personId: number;
	exp: number;
}

/** Issues a session for `personId` and sets it as an httpOnly cookie on the response. */
export const createSession = async (
	c: Context,
	personId: number,
	secret: string,
): Promise<void> => {
	const payload: SessionPayload = {
		personId,
		exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
	};
	const token = await sign(payload, secret, "HS256");

	setCookie(c, COOKIE_NAME, token, {
		httpOnly: true,
		sameSite: "Lax",
		// Not `secure: true` — this app is served over plain HTTP on the LAN
		// (see deployment notes), so a Secure cookie would never be sent.
		path: "/",
		maxAge: SESSION_LIFETIME_SECONDS,
	});
};

/** Reads and verifies the session cookie on a request, if any. Returns the personId, or null. */
export const readSession = async (c: Context, secret: string): Promise<number | null> => {
	const token = getCookie(c, COOKIE_NAME);
	if (!token) {
		return null;
	}

	try {
		const payload = (await verify(token, secret, "HS256")) as unknown as SessionPayload;
		return payload.personId;
	} catch {
		return null;
	}
};

export const clearSession = (c: Context): void => {
	deleteCookie(c, COOKIE_NAME, { path: "/" });
};
