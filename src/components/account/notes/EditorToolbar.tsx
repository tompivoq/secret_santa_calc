import clsx from "clsx";
import { type ReactNode } from "react";
import type { ActiveState, SaveStatus } from "./types";
import type { ChainedCommands } from "@tiptap/react";
import {
	FaBold,
	FaHeading,
	FaItalic,
	FaLink,
	FaListCheck,
	FaListOl,
	FaListUl,
} from "react-icons/fa6";

const STATUS_TEXT: Record<SaveStatus, string> = {
	saved: "Gemt",
	pending: "Ikke gemt endnu…",
	saving: "Gemmer…",
	error: "Kunne ikke gemme",
	conflict: "Ikke gemt",
};

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
			"cursor-pointer rounded-md border border-neutral-300 p-2",
			active ? "bg-accent-light text-accent-foreground" : "hover:bg-bg-sunken",
		)}
	>
		{children}
	</button>
);

interface EditorToolbarProps {
	active: ActiveState;
	linkFormOpen: boolean;
	toggleLinkForm: () => void;
	status: SaveStatus;
	chain: () => ChainedCommands;
}

export const EditorToolbar = ({
	active,
	chain,
	linkFormOpen,
	toggleLinkForm,
	status,
}: EditorToolbarProps) => {
	return (
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
			<ToolbarButton label="Link" active={active.link || linkFormOpen} onClick={toggleLinkForm}>
				<FaLink className="size-3.5" aria-hidden />
			</ToolbarButton>

			<span role="status" className="text-text-muted ml-auto text-xs">
				{STATUS_TEXT[status]}
			</span>
		</div>
	);
};
