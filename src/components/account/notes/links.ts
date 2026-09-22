/**
 * Only web links — the same rule the server enforces on save (see
 * server/src/notes/document.ts), applied here too so the editor never even
 * holds a javascript: link, whether typed, pasted or auto-linked.
 *
 * Parsed rather than prefix-matched, so "  JaVaScRiPt:" and friends can't
 * sneak by.
 */
export const isSafeHref = (href: string): boolean => {
	try {
		const { protocol } = new URL(href);
		return protocol === "http:" || protocol === "https:";
	} catch {
		return false;
	}
};

/**
 * What the link field turns into an href: "www.shop.dk" becomes
 * "https://www.shop.dk", since that's what people paste or type. Returns
 * null for anything that still isn't a web link — including something
 * that already names a different scheme, like "javascript:".
 */
export const normalizeHref = (input: string): string | null => {
	const trimmed = input.trim();
	if (trimmed === "") {
		return null;
	}
	const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
	const candidate = hasScheme ? trimmed : `https://${trimmed}`;
	return isSafeHref(candidate) ? candidate : null;
};
