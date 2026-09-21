/** Mirrors the server's limit — see server/src/messages/messages.ts. */
export const MAX_MESSAGE_LENGTH = 1000;

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("da");

export const fieldClassName = "border-input-border rounded-md border px-2.5 py-2 text-base";
