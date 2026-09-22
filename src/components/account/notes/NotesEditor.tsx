import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode, type SubmitEvent } from "react";
import {
	FaBold,
	FaHeading,
	FaItalic,
	FaLink,
	FaListCheck,
	FaListOl,
	FaListUl,
} from "react-icons/fa6";
import { useSaveNoteMutation, type Note } from "../../../store/notesApi";
import { Button } from "../../shared";
import { isSafeHref, normalizeHref } from "./links";

/** How long typing has to pause before the note is saved. */
const SAVE_DELAY_MS = 1000;

type SaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";

const STATUS_TEXT: Record<SaveStatus, string> = {
	saved: "Gemt",
	pending: "Ikke gemt endnu…",
	saving: "Gemmer…",
	error: "Kunne ikke gemme",
	conflict: "Ikke gemt",
};

const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };

/** Narrows RTK Query's opaque mutation error to a 409 carrying the newer note. */
const conflictFrom = (error: unknown): Note | null =>
	typeof error === "object" &&
	error !== null &&
	"status" in error &&
	error.status === 409 &&
	"data" in error &&
	typeof error.data === "object" &&
	error.data !== null &&
	"current" in error.data
		? (error.data.current as Note)
		: null;

const extensions = [
	StarterKit.configure({
		// Only what the server accepts — see server/src/notes/document.ts.
		blockquote: false,
		code: false,
		codeBlock: false,
		horizontalRule: false,
		strike: false,
		underline: false,
		heading: { levels: [2, 3] },
		link: {
			// A click in the editor places the cursor; links open from the bar
			// under the toolbar, or with Ctrl/Cmd+click — see handleClick.
			openOnClick: false,
			autolink: true,
			linkOnPaste: true,
			defaultProtocol: "https",
			// Typed, pasted, auto-linked or loaded: anything but http(s) never
			// becomes a link. The server checks again on save.
			isAllowedUri: (url) => isSafeHref(url),
			shouldAutoLink: (url) => isSafeHref(url),
			HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
		},
	}),
	TaskList,
	TaskItem.configure({ nested: true }),
	Placeholder.configure({
		placeholder: "Skriv gaveidéer, links til butikker, datoer…",
	}),
];

const ToolbarButton = ({
	label,
	active,
	onClick,
	children,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
	children: ReactNode;
}) => (
	<button
		type="button"
		aria-label={label}
		title={label}
		aria-pressed={active}
		// Keeps the editor's selection, so the button applies to it.
		onMouseDown={(event) => event.preventDefault()}
		onClick={onClick}
		className={clsx(
			"cursor-pointer rounded-md border p-2",
			active ? "bg-accent text-accent-foreground" : "hover:bg-bg-sunken border-transparent",
		)}
	>
		{children}
	</button>
);

/** Adding, changing or removing the link under the cursor. */
const LinkForm = ({ editor, onDone }: { editor: Editor; onDone: () => void }) => {
	const [value, setValue] = useState(
		() => (editor.getAttributes("link").href as string | undefined) ?? "",
	);
	const [invalid, setInvalid] = useState(false);
	const isEditing = editor.isActive("link");

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		const href = normalizeHref(value);
		if (!href) {
			setInvalid(true);
			return;
		}
		if (isEditing || !editor.state.selection.empty) {
			editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
		} else {
			// Nothing selected: insert the address itself as the link text.
			editor
				.chain()
				.focus()
				.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
				.run();
		}
		onDone();
	};

	return (
		// noValidate: the browser's own url check would refuse "www.shop.dk"
		// outright, before normalizeHref gets the chance to add the https://.
		<form onSubmit={submit} noValidate className="flex flex-col gap-2 text-sm">
			<label className="flex flex-col gap-1">
				Link-adresse
				<input
					type="url"
					inputMode="url"
					autoFocus
					value={value}
					onChange={(event) => {
						setValue(event.target.value);
						setInvalid(false);
					}}
					placeholder="https://www.eksempel.dk/gave"
					className="border-input-border rounded-md border px-2.5 py-1.5 text-base"
					aria-invalid={invalid}
				/>
			</label>
			{invalid && (
				<p className="text-error text-sm">Kun links der starter med http:// eller https://</p>
			)}
			<div className="flex flex-row flex-wrap justify-end gap-2">
				{isEditing && (
					<Button
						behaviour="destructive"
						onClick={() => {
							editor.chain().focus().extendMarkRange("link").unsetLink().run();
							onDone();
						}}
					>
						Fjern link
					</Button>
				)}
				<Button behaviour="neutral" onClick={onDone}>
					Annuller
				</Button>
				<Button type="submit" behaviour="action">
					Gem link
				</Button>
			</div>
		</form>
	);
};

/**
 * The notepad itself. Loaded on demand (see Notes.tsx), since the editor is
 * by far the largest thing on the page.
 *
 * Saves on its own a moment after typing stops. Each save says which
 * version it started from; if the note was saved elsewhere in between
 * (another tab or device), the server refuses it and the choice of which
 * version to keep is put to the person rather than made for them.
 */
function NotesEditor({ note }: { note: Note }) {
	const [saveNote] = useSaveNoteMutation();
	const [status, setStatus] = useState<SaveStatus>("saved");
	const [conflict, setConflict] = useState<Note | null>(null);
	const [linkFormOpen, setLinkFormOpen] = useState(false);

	// Refs, not state: read inside async saves and timers, which would
	// otherwise see the values from when they were scheduled.
	const version = useRef(note.version);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inFlight = useRef(false);
	const changedDuringSave = useRef(false);
	const inConflict = useRef(false);

	// Plain functions rather than useCallback: everything they read is a ref
	// or a stable setter, so a copy captured by the editor or a timer is
	// never stale — and save calls itself, which memoization can't express.
	async function save(editor: Editor) {
		if (inConflict.current) {
			return;
		}
		if (inFlight.current) {
			changedDuringSave.current = true;
			return;
		}
		inFlight.current = true;
		setStatus("saving");
		try {
			const saved = await saveNote({
				content: editor.getJSON(),
				baseVersion: version.current,
			}).unwrap();
			version.current = saved.version;
			setStatus(changedDuringSave.current ? "pending" : "saved");
		} catch (error) {
			const current = conflictFrom(error);
			if (current) {
				inConflict.current = true;
				changedDuringSave.current = false;
				setConflict(current);
				setStatus("conflict");
			} else {
				setStatus("error");
			}
		} finally {
			inFlight.current = false;
			if (changedDuringSave.current && !inConflict.current) {
				changedDuringSave.current = false;
				void save(editor);
			}
		}
	}

	function scheduleSave(editor: Editor) {
		if (timer.current) clearTimeout(timer.current);
		if (!inConflict.current) setStatus("pending");
		timer.current = setTimeout(() => {
			timer.current = null;
			void save(editor);
		}, SAVE_DELAY_MS);
	}

	const editor = useEditor({
		extensions,
		content: note.content ?? EMPTY_DOCUMENT,
		onUpdate: ({ editor }) => scheduleSave(editor),
		editorProps: {
			attributes: {
				class: "notes-content min-h-40 rounded-md border px-3 py-2 text-left",
				role: "textbox",
				"aria-multiline": "true",
				"aria-label": "Mine noter",
			},
			// Ctrl/Cmd+click opens a link, in a new tab that can't reach back
			// into this one. A plain click stays an editing click.
			handleClick: (_view, _pos, event) => {
				const anchor = (event.target as HTMLElement).closest("a");
				if (!anchor || !(event.ctrlKey || event.metaKey)) {
					return false;
				}
				const href = anchor.getAttribute("href");
				if (href && isSafeHref(href)) {
					window.open(href, "_blank", "noopener,noreferrer");
				}
				return true;
			},
		},
	});

	const active = useEditorState({
		editor,
		selector: ({ editor: current }) => ({
			bold: current?.isActive("bold") ?? false,
			italic: current?.isActive("italic") ?? false,
			heading: current?.isActive("heading") ?? false,
			bulletList: current?.isActive("bulletList") ?? false,
			orderedList: current?.isActive("orderedList") ?? false,
			taskList: current?.isActive("taskList") ?? false,
			link: current?.isActive("link") ?? false,
			href: (current?.getAttributes("link").href as string | undefined) ?? null,
		}),
	});

	// Leaving the page (or this component) with a save still waiting: send
	// it now rather than drop it. Keyed on the editor alone — the save it
	// captures only reads refs, so it's never out of date, and listing it
	// would re-run this (and save) on every render.
	useEffect(
		() => () => {
			if (timer.current && editor) {
				clearTimeout(timer.current);
				void save(editor);
			}
		},
		// oxlint-disable-next-line react-hooks/exhaustive-deps
		[editor],
	);

	// Closing the tab can't wait for a save, so ask first.
	useEffect(() => {
		if (status === "saved") {
			return;
		}
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [status]);

	if (!editor || !active) {
		return null;
	}

	const useSaved = () => {
		if (!conflict) return;
		editor.commands.setContent(conflict.content ?? EMPTY_DOCUMENT, { emitUpdate: false });
		version.current = conflict.version;
		inConflict.current = false;
		setConflict(null);
		setStatus("saved");
	};

	const keepMine = () => {
		if (!conflict) return;
		// Save on top of the newer version, on purpose this time.
		version.current = conflict.version;
		inConflict.current = false;
		setConflict(null);
		void save(editor);
	};

	const chain = () => editor.chain().focus();

	return (
		<div className="flex flex-col gap-2">
			<div
				role="toolbar"
				aria-label="Formatering"
				className="flex flex-row flex-wrap items-center gap-1"
			>
				<ToolbarButton label="Fed" active={active.bold} onClick={() => chain().toggleBold().run()}>
					<FaBold className="size-3.5" aria-hidden />
				</ToolbarButton>
				<ToolbarButton
					label="Kursiv"
					active={active.italic}
					onClick={() => chain().toggleItalic().run()}
				>
					<FaItalic className="size-3.5" aria-hidden />
				</ToolbarButton>
				<ToolbarButton
					label="Overskrift"
					active={active.heading}
					onClick={() => chain().toggleHeading({ level: 2 }).run()}
				>
					<FaHeading className="size-3.5" aria-hidden />
				</ToolbarButton>
				<ToolbarButton
					label="Punktliste"
					active={active.bulletList}
					onClick={() => chain().toggleBulletList().run()}
				>
					<FaListUl className="size-3.5" aria-hidden />
				</ToolbarButton>
				<ToolbarButton
					label="Nummereret liste"
					active={active.orderedList}
					onClick={() => chain().toggleOrderedList().run()}
				>
					<FaListOl className="size-3.5" aria-hidden />
				</ToolbarButton>
				<ToolbarButton
					label="Tjekliste"
					active={active.taskList}
					onClick={() => chain().toggleTaskList().run()}
				>
					<FaListCheck className="size-3.5" aria-hidden />
				</ToolbarButton>
				<ToolbarButton
					label="Link"
					active={active.link || linkFormOpen}
					onClick={() => setLinkFormOpen((open) => !open)}
				>
					<FaLink className="size-3.5" aria-hidden />
				</ToolbarButton>

				<span role="status" className="text-text-muted ml-auto text-xs">
					{STATUS_TEXT[status]}
				</span>
			</div>

			{linkFormOpen && <LinkForm editor={editor} onDone={() => setLinkFormOpen(false)} />}

			{!linkFormOpen && active.link && active.href && isSafeHref(active.href) && (
				<p className="text-sm">
					<a href={active.href} target="_blank" rel="noopener noreferrer nofollow">
						Åbn link ↗
					</a>{" "}
					<span className="text-text-muted text-xs break-all">{active.href}</span>
				</p>
			)}

			<EditorContent editor={editor} />

			{status === "error" && (
				<div className="text-error flex flex-row flex-wrap items-center gap-2 text-sm">
					<span>Dine noter kunne ikke gemmes.</span>
					<Button behaviour="neutral" onClick={() => void save(editor)}>
						Prøv igen
					</Button>
				</div>
			)}

			{conflict && (
				<div
					className="border-error flex flex-col gap-2 rounded-md border p-3 text-sm"
					role="alert"
				>
					<p>
						Dine noter er blevet ændret et andet sted (f.eks. på en anden enhed), siden du åbnede
						dem. Hvilken version vil du beholde?
					</p>
					<div className="flex flex-row flex-wrap justify-end gap-2">
						<Button behaviour="neutral" onClick={useSaved}>
							Hent den gemte version
						</Button>
						<Button behaviour="action" onClick={keepMine}>
							Behold mine ændringer
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

export default NotesEditor;
