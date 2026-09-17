import type { LoginLinkEmailInput } from "./loginLinks.js";
import type { MailMessage } from "./mailer.js";

const escapeHtml = (value: string): string =>
	value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The invitation, sent before any draw has been made: here's the app, log
 * in and choose a password, so that when the draw does happen, getting in
 * isn't the hard part.
 *
 * In Danish, like the rest of what people see. Deliberately promises
 * nothing about when the draw will be — that's for whoever runs it to say.
 */
export const inviteEmail = ({ name, loginUrl }: LoginLinkEmailInput): Omit<MailMessage, "to"> => {
	const subject = "Du er inviteret til årets julenisse-lodtrækning";

	const text = [
		`Hej ${name},`,
		"",
		"Nisserne er ved at gøre sig klar til dette års julegave-lodtrækning, og har udviklet en ny udgave af systemet!",
		"Lodtrækningen er ikke lavet endnu, men du kan allerede nu logge ind og vælge din egen adgangskode.",
		"",
		"Åbn dette link for at komme i gang:",
		loginUrl,
		"",
		"Linket logger dig ind af sig selv, og virker kun én gang, så send det ikke videre!",
		"Når lodtrækningen er gennemfort får du besked igen, og så kan du se på siden hvem du skal give til i år!",
		"",
		"God jul!",
	].join("\n");

	const html = [
		`<p>Hej ${escapeHtml(name)},</p>`,
		"<p>Nisserne er ved at gøre sig klar til dette års julegave-lodtrækning, og har udviklet en ny udgave af systemet!</p>",
		"<p>Lodtrækningen er ikke lavet endnu, men du kan allerede nu logge ind og vælge din egen adgangskode.</p>",
		`<p><a href="${escapeHtml(loginUrl)}">Log ind og kom i gang</a></p>`,
		"<p>Linket logger dig ind af sig selv, og virker kun én gang, så send det ikke videre!</p>",
		"<p>Når lodtrækningen er gennemfort får du besked igen, og så kan du se på siden hvem du skal give til i år!</p>",
		"<p>God jul!</p>",
	].join("\n");

	return { subject, text, html };
};
