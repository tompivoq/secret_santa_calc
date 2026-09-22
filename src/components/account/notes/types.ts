export type SaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";

export interface ActiveState {
	bold: boolean;
	italic: boolean;
	heading: boolean;
	bulletList: boolean;
	orderedList: boolean;
	taskList: boolean;
	link: boolean;
	href: string | null;
}
