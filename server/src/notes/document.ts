import { z } from "zod";

/*
 * What a stored note may contain: the editor's JSON document, restricted to
 * the formatting the notes editor offers. This is the security boundary, not
 * the editor — anyone can send the API whatever JSON they like, so a note is
 * only ever stored once it passes this.
 *
 * Two things make that enough. The document is JSON, never HTML, so there's
 * no markup to smuggle a <script> or an onerror= into; the editor rebuilds
 * the page from known node types only. And the one attribute that could run
 * code if it got through — a link's href, via javascript: and friends — has
 * to parse as an http(s) URL.
 */

/** Serialized size cap, in characters. Several pages of notes; not a novel. */
export const MAX_NOTE_LENGTH = 100_000;

/**
 * How deeply blocks may nest (lists in lists in lists). Real notes stay far
 * below this; the cap is there so a hostile document can't recurse the
 * validator into the ground.
 */
export const MAX_NOTE_DEPTH = 20;

const MAX_HREF_LENGTH = 2000;

/** Only web links. Parsed rather than prefix-matched, so "  JaVaScRiPt:" and friends can't sneak by. */
export const isSafeHref = (href: string): boolean => {
	try {
		const { protocol } = new URL(href);
		return protocol === "http:" || protocol === "https:";
	} catch {
		return false;
	}
};

// Attribute values the editor itself produces (heading level, list start,
// checked, a link's target/rel). Primitives only — nothing nested.
const attrValue = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);
const attrs = z.record(z.string().max(50), attrValue).optional();

const linkMark = z
	.object({
		type: z.literal("link"),
		attrs: z
			.object({ href: z.string().max(MAX_HREF_LENGTH).refine(isSafeHref) })
			.catchall(attrValue),
	})
	.strict();

const styleMark = z.object({ type: z.enum(["bold", "italic"]), attrs }).strict();

const textNode = z
	.object({
		type: z.literal("text"),
		text: z.string().min(1),
		marks: z.array(z.union([linkMark, styleMark])).optional(),
	})
	.strict();

/** Block-level nodes the editor offers. Anything else — images, code, tables — is refused. */
export const BLOCK_TYPES = [
	"paragraph",
	"heading",
	"bulletList",
	"orderedList",
	"listItem",
	"taskList",
	"taskItem",
	"hardBreak",
] as const;

export type NoteNode =
	| z.infer<typeof textNode>
	| {
			type: (typeof BLOCK_TYPES)[number];
			attrs?: Record<string, string | number | boolean | null> | undefined;
			content?: NoteNode[] | undefined;
	  };

const node: z.ZodType<NoteNode> = z.lazy(() =>
	z.union([
		textNode,
		z
			.object({
				type: z.enum(BLOCK_TYPES),
				attrs,
				content: z.array(node).optional(),
			})
			.strict(),
	]),
);

export const noteDocumentSchema = z
	.object({ type: z.literal("doc"), content: z.array(node).optional() })
	.strict();

export type NoteDocument = z.infer<typeof noteDocumentSchema>;

/** Depth of nested `content` arrays, counted without recursion so the count itself can't overflow. */
const depthOf = (value: unknown): number => {
	let deepest = 0;
	const stack: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
	while (stack.length > 0) {
		const { value: current, depth } = stack.pop()!;
		deepest = Math.max(deepest, depth);
		if (deepest > MAX_NOTE_DEPTH) {
			return deepest;
		}
		const content =
			typeof current === "object" && current !== null && "content" in current
				? (current as { content: unknown }).content
				: undefined;
		if (Array.isArray(content)) {
			for (const child of content) {
				stack.push({ value: child, depth: depth + 1 });
			}
		}
	}
	return deepest;
};

export type ParseResult =
	| { ok: true; document: NoteDocument; serialized: string }
	| { ok: false; reason: "too-large" | "too-deep" | "invalid" };

/**
 * Checks an incoming document against everything above, in cheapest-first
 * order. Returns it re-serialized from the validated value, so what's stored
 * is exactly what passed — no extra keys riding along.
 */
export const parseNoteDocument = (value: unknown): ParseResult => {
	if (JSON.stringify(value ?? null).length > MAX_NOTE_LENGTH) {
		return { ok: false, reason: "too-large" };
	}
	if (depthOf(value) > MAX_NOTE_DEPTH) {
		return { ok: false, reason: "too-deep" };
	}
	const parsed = noteDocumentSchema.safeParse(value);
	if (!parsed.success) {
		return { ok: false, reason: "invalid" };
	}
	return { ok: true, document: parsed.data, serialized: JSON.stringify(parsed.data) };
};
