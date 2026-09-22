import { describe, expect, it } from "vitest";
import { MAX_NOTE_DEPTH, MAX_NOTE_LENGTH, isSafeHref, parseNoteDocument } from "./document.js";

const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const text = (value: string, marks?: unknown[]) => ({
	type: "text",
	text: value,
	...(marks && { marks }),
});
const doc = (...content: unknown[]) => ({ type: "doc", content });
const link = (href: string) => ({
	type: "link",
	attrs: { href, target: "_blank", rel: "noopener noreferrer nofollow", class: null },
});

describe("isSafeHref", () => {
	it.each(["https://www.example.com/gave?id=1", "http://example.dk"])("allows %s", (href) => {
		expect(isSafeHref(href)).toBe(true);
	});

	it.each([
		"javascript:alert(1)",
		"JaVaScRiPt:alert(1)",
		"  javascript:alert(1)",
		"java\tscript:alert(1)",
		"java\nscript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"vbscript:msgbox(1)",
		"mailto:someone@example.com",
		"file:///etc/passwd",
		"/relative/path",
		"//evil.example.com",
		"not a url",
		"",
	])("refuses %j", (href) => {
		expect(isSafeHref(href)).toBe(false);
	});
});

describe("parseNoteDocument", () => {
	it("accepts everything the editor offers", () => {
		const note = doc(
			{ type: "heading", attrs: { level: 2 }, content: [text("Idéer til Anna")] },
			paragraph(
				text("Fed", [{ type: "bold" }]),
				text(" og "),
				text("kursiv", [{ type: "italic" }]),
			),
			paragraph(text("Kan købes her", [link("https://www.example.dk/teater")])),
			{
				type: "bulletList",
				content: [{ type: "listItem", content: [paragraph(text("Punkt"))] }],
			},
			{
				type: "orderedList",
				attrs: { start: 1, type: null },
				content: [{ type: "listItem", content: [paragraph(text("Første"))] }],
			},
			{
				type: "taskList",
				content: [
					{ type: "taskItem", attrs: { checked: true }, content: [paragraph(text("Købt"))] },
				],
			},
			paragraph(text("Linje"), { type: "hardBreak" }, text("skift")),
		);

		const result = parseNoteDocument(note);
		expect(result.ok).toBe(true);
	});

	it("accepts an empty document", () => {
		expect(parseNoteDocument({ type: "doc", content: [{ type: "paragraph" }] }).ok).toBe(true);
	});

	it("keeps markup in text as plain text, which is harmless", () => {
		// Stored as the characters "<script>…", rendered as text — never parsed as HTML.
		expect(parseNoteDocument(doc(paragraph(text("<script>alert(1)</script>")))).ok).toBe(true);
	});

	it("refuses a link that isn't http(s)", () => {
		const result = parseNoteDocument(doc(paragraph(text("klik", [link("javascript:alert(1)")]))));
		expect(result).toEqual({ ok: false, reason: "invalid" });
	});

	it("refuses a link without an href", () => {
		const result = parseNoteDocument(doc(paragraph(text("klik", [{ type: "link", attrs: {} }]))));
		expect(result.ok).toBe(false);
	});

	it.each(["image", "codeBlock", "blockquote", "table", "iframe"])(
		"refuses a %s node the editor doesn't offer",
		(type) => {
			expect(parseNoteDocument(doc({ type, attrs: { src: "https://x" } })).ok).toBe(false);
		},
	);

	it.each(["code", "strike", "underline", "highlight"])("refuses a %s mark", (type) => {
		expect(parseNoteDocument(doc(paragraph(text("x", [{ type }])))).ok).toBe(false);
	});

	it("refuses keys the editor doesn't produce, like an event handler", () => {
		const result = parseNoteDocument(doc({ type: "paragraph", onclick: "alert(1)" }));
		expect(result.ok).toBe(false);
	});

	it("refuses nested attribute values", () => {
		const result = parseNoteDocument(doc({ type: "heading", attrs: { level: { evil: true } } }));
		expect(result.ok).toBe(false);
	});

	it("refuses anything that isn't a doc", () => {
		expect(parseNoteDocument("<p>hej</p>").ok).toBe(false);
		expect(parseNoteDocument(null).ok).toBe(false);
		expect(parseNoteDocument({ type: "paragraph" }).ok).toBe(false);
	});

	it("refuses a note over the size cap", () => {
		const result = parseNoteDocument(doc(paragraph(text("x".repeat(MAX_NOTE_LENGTH)))));
		expect(result).toEqual({ ok: false, reason: "too-large" });
	});

	it("refuses nesting deeper than the cap", () => {
		let nested: unknown = paragraph(text("bund"));
		for (let i = 0; i < MAX_NOTE_DEPTH + 1; i++) {
			nested = { type: "bulletList", content: [{ type: "listItem", content: [nested] }] };
		}
		expect(parseNoteDocument(doc(nested))).toEqual({ ok: false, reason: "too-deep" });
	});

	it("re-serializes from the validated value", () => {
		const result = parseNoteDocument(doc(paragraph(text("hej"))));
		expect(result.ok && JSON.parse(result.serialized)).toEqual(doc(paragraph(text("hej"))));
	});
});
