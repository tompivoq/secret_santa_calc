import type { MailMessage } from "./mailer.js";

const escapeHtml = (value: string): string =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface MatchEmailInput {
	/** Who's being written to — used to greet them, never to name their match. */
	name: string;
	/** The single-use login link, already built against APP_BASE_URL. */
	loginUrl: string;
}

/**
 * The "your match is ready" email.
 *
 * Deliberately says nothing about who the recipient drew. Putting the
 * match in the email would leave it sitting in an inbox in plaintext
 * indefinitely, readable by anyone who later borrows the phone it's open
 * on — the reason option C was turned down in TODO.md. The link is what
 * carries them to it.
 */
export const matchReadyEmail = ({ name, loginUrl }: MatchEmailInput): Omit<MailMessage, "to"> => {
	const subject = "Your Secret Santa match is ready";

	const text = [
		`Hi ${name},`,
		"",
		"The Secret Santa draw has been made, and yours is waiting for you.",
		"",
		"Open this link to see who you're giving to:",
		loginUrl,
		"",
		"The link logs you in on its own, so there's no password to remember.",
		"It works once, and only for you — don't forward it to anyone.",
		"",
		"God jul!",
	].join("\n");

	const html = [
		`<p>Hi ${escapeHtml(name)},</p>`,
		"<p>The Secret Santa draw has been made, and yours is waiting for you.</p>",
		`<p><a href="${escapeHtml(loginUrl)}">See who you're giving to</a></p>`,
		"<p>The link logs you in on its own, so there's no password to remember. It works once, and only for you — don't forward it to anyone.</p>",
		"<p>God jul!</p>",
	].join("\n");

	return { subject, text, html };
};
