import type { LoginLinkEmailInput } from "./loginLinks.js";
import type { MailMessage } from "./mailer.js";

const escapeHtml = (value: string): string =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/*
 * Neither email includes the message itself — only that there is one, and
 * where to read it. Same reasoning as the match email: an inbox is read by
 * whoever is holding the phone, and it keeps everything forever.
 *
 * The question email also deliberately says nothing that could hint at who
 * asked or whom it's about.
 */

/** To whoever was asked: someone anonymous has a question for them. */
export const questionReceivedEmail = ({
	name,
	loginUrl,
}: LoginLinkEmailInput): Omit<MailMessage, "to"> => {
	const subject = "En nisse har et spørgsmål til dig";

	const text = [
		`Hej ${name},`,
		"",
		"En af nisserne har stillet dig et anonymt spørgsmål.",
		"",
		"Du kan læse og besvare det her:",
		loginUrl,
		"",
		"God jul!",
		"Julenissen",
	].join("\n");

	const html = [
		`<p>Hej ${escapeHtml(name)},</p>`,
		"<p>En af nisserne har stillet dig et anonymt spørgsmål.</p>",
		`<p><a href="${escapeHtml(loginUrl)}">Læs og besvar spørgsmålet</a></p>`,
		"<p>God jul!</p>",
		"<p>Julenissen</p>",
	].join("\n");

	return { subject, text, html };
};

/** To whoever asked: their question has been answered. */
export const answerReceivedEmail = ({
	name,
	loginUrl,
}: LoginLinkEmailInput): Omit<MailMessage, "to"> => {
	const subject = "Du har fået svar på dit spørgsmål";

	const text = [
		`Hej ${name},`,
		"",
		"Dit anonyme spørgsmål er blevet besvaret.",
		"",
		"Du kan læse svaret her:",
		loginUrl,
		"",
		"God jul!",
		"Julenissen",
	].join("\n");

	const html = [
		`<p>Hej ${escapeHtml(name)},</p>`,
		"<p>Dit anonyme spørgsmål er blevet besvaret.</p>",
		`<p><a href="${escapeHtml(loginUrl)}">Læs svaret</a></p>`,
		"<p>God jul!</p>",
		"<p>Julenissen</p>",
	].join("\n");

	return { subject, text, html };
};
