/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import App from "./App";
import { createStore } from "./store/store";
import type { Person } from "./models/person";
import type { Note } from "./store/notesApi";
import type { JSONContent } from "@tiptap/react";

const PERSON: Person = {
	id: 1,
	name: "Carl",
	email: "carl@example.com",
	phone: 11223344,
	isAdmin: false,
};

const noteWith = (...content: JSONContent[]): JSONContent => ({ type: "doc", content });
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const text = (value: string, marks?: JSONContent["marks"]): JSONContent => ({
	type: "text",
	text: value,
	...(marks && { marks }),
});

/**
 * A signed-in participant with a stored note, and a PUT that either accepts
 * the save (bumping the version, as the server does) or answers `onSave`.
 */
const stubApi = (initial: Note, options: { onSave?: () => Response } = {}) => {
	let note = initial;
	const saves: { content: unknown; baseVersion: number }[] = [];

	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = input instanceof Request ? input : new Request(input, init);
			const url = new URL(request.url);

			if (url.pathname === "/api/auth/me" && request.method === "GET") {
				return new Response(JSON.stringify({ person: PERSON, mustChangePassword: false }), {
					status: 200,
				});
			}

			if (url.pathname === "/api/notes" && request.method === "GET") {
				return new Response(JSON.stringify(note), { status: 200 });
			}

			if (url.pathname === "/api/notes" && request.method === "PUT") {
				const body = (await request.json()) as { content: Note["content"]; baseVersion: number };
				saves.push(body);
				if (options.onSave) {
					return options.onSave();
				}
				note = {
					content: body.content,
					version: note.version + 1,
					updatedAt: new Date().toISOString(),
				};
				return new Response(JSON.stringify({ version: note.version, updatedAt: note.updatedAt }), {
					status: 200,
				});
			}

			return new Response(null, { status: 204 });
		}),
	);

	return { saves };
};

afterEach(() => {
	vi.unstubAllGlobals();
	// See the identical comment in Auth.integration.test.tsx.
	cleanup();
});

const renderAccountPage = () => {
	window.history.pushState({}, "", "/account");
	return render(
		<Provider store={createStore()}>
			<App />
		</Provider>,
	);
};

const notesSection = async () => within(await screen.findByRole("region", { name: "Mine noter" }));

/** The editable area itself — the one element in the section named "Mine noter" that's a textbox. */
const editorIn = async (section: Awaited<ReturnType<typeof notesSection>>) =>
	section.findByRole("textbox", { name: "Mine noter" });

describe("private notes", () => {
	it("shows the saved note, with its formatting", async () => {
		stubApi({
			content: noteWith(
				{ type: "heading", attrs: { level: 2 }, content: [text("Idéer")] },
				paragraph(text("Teater", [{ type: "bold" }])),
			),
			version: 3,
			updatedAt: null,
		});
		renderAccountPage();

		const section = await notesSection();
		const editor = await editorIn(section);
		expect(within(editor).getByRole("heading", { name: "Idéer" })).not.toBeNull();
		expect(within(editor).getByText("Teater").tagName).toBe("STRONG");
	});

	it("opens saved links in a new tab that can't reach back into this one", async () => {
		stubApi({
			content: noteWith(
				paragraph(
					text("butikken", [{ type: "link", attrs: { href: "https://www.example.dk/gave" } }]),
				),
			),
			version: 1,
			updatedAt: null,
		});
		renderAccountPage();

		const link = within(await editorIn(await notesSection()))
			.getByText("butikken")
			.closest("a")!;
		expect(link.getAttribute("href")).toBe("https://www.example.dk/gave");
		expect(link.getAttribute("target")).toBe("_blank");
		expect(link.getAttribute("rel")).toContain("noopener");
	});

	it("never renders a javascript: link, even if one reached the page", async () => {
		// The server refuses these on save; this is the editor's own line of
		// defence should one ever arrive regardless.
		stubApi({
			content: noteWith(
				paragraph(text("klik", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])),
			),
			version: 1,
			updatedAt: null,
		});
		renderAccountPage();

		const editor = await editorIn(await notesSection());
		await within(editor).findByText("klik");
		for (const anchor of editor.querySelectorAll("a")) {
			expect(anchor.getAttribute("href") ?? "").not.toMatch(/javascript:/i);
		}
	});

	it("saves on its own after typing, from the version it loaded", async () => {
		const { saves } = stubApi({ content: null, version: 0, updatedAt: null });
		const user = userEvent.setup();
		renderAccountPage();

		const section = await notesSection();
		await user.click(await editorIn(section));
		await user.keyboard("Teaterbilletter");

		await waitFor(() => expect(saves).toHaveLength(1), { timeout: 3000 });
		expect(saves[0]!.baseVersion).toBe(0);
		expect(JSON.stringify(saves[0]!.content)).toContain("Teaterbilletter");
		expect(await section.findByText("Gemt")).not.toBeNull();
	});

	it("adds a link, filling in https:// for a bare address", async () => {
		const { saves } = stubApi({ content: null, version: 0, updatedAt: null });
		const user = userEvent.setup();
		renderAccountPage();

		const section = await notesSection();
		await user.click(await editorIn(section));
		await user.click(section.getByRole("button", { name: "Link" }));
		await user.type(section.getByLabelText("Link-adresse"), "www.example.dk/gave");
		await user.click(section.getByRole("button", { name: "Gem link" }));

		const link = within(await editorIn(section)).getByText("https://www.example.dk/gave");
		expect(link.closest("a")!.getAttribute("href")).toBe("https://www.example.dk/gave");
		await waitFor(() => expect(saves).toHaveLength(1), { timeout: 3000 });
	});

	it("refuses a link that isn't http(s)", async () => {
		stubApi({ content: null, version: 0, updatedAt: null });
		const user = userEvent.setup();
		renderAccountPage();

		const section = await notesSection();
		await editorIn(section);
		await user.click(section.getByRole("button", { name: "Link" }));
		await user.type(section.getByLabelText("Link-adresse"), "javascript:alert(1)");
		await user.click(section.getByRole("button", { name: "Gem link" }));

		expect(section.getByText("Kun links der starter med http:// eller https://")).not.toBeNull();
		expect((await editorIn(section)).querySelector("a")).toBeNull();
	});

	it("asks which version to keep when the note was saved elsewhere", async () => {
		const elsewhere: Note = {
			content: noteWith(paragraph(text("Skrevet på telefonen"))),
			version: 2,
			updatedAt: new Date().toISOString(),
		};
		stubApi(
			{ content: null, version: 0, updatedAt: null },
			{
				onSave: () =>
					new Response(
						JSON.stringify({ error: "Note was changed elsewhere", current: elsewhere }),
						{
							status: 409,
						},
					),
			},
		);
		const user = userEvent.setup();
		renderAccountPage();

		const section = await notesSection();
		await user.click(await editorIn(section));
		await user.keyboard("Skrevet på computeren");

		const alert = await section.findByRole("alert", {}, { timeout: 3000 });
		await user.click(within(alert).getByRole("button", { name: "Hent den gemte version" }));

		expect(await within(await editorIn(section)).findByText("Skrevet på telefonen")).not.toBeNull();
		expect(section.queryByRole("alert")).toBeNull();
	});
});
