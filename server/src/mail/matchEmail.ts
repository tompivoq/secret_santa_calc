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
	const subject = "Dit julegave-match er klar!";

	const text = [
		`Hej ${name},`,
		"",
		"Nisserne har nu gennemført lodtrækningen til dette års julegave-givning,",
		"og har fundet ud af hvem der skal give gave til hvem!",
		"",
		"Du kan se hvem du er blevet tildelt via dette link:",
		loginUrl,
		"",
		"Hvis du ikke allerede har været inde og oprette et password, vil du som det første blive bedt om at lave det.",
		"",
		"God jul, og god fornøjelse",
		"Julenissen",
	].join("\n");

	const html = [
		`<p>Hej ${escapeHtml(name)},</p>`,
		"<p>Nisserne har nu gennemført lodtrækningen til dette års julegave-givning, og har fundet ud af hvem der skal give gave til hvem!</p>",
		"<p>Du kan se hvem du er blevet tildelt via dette link:</p>",
		`<p><a href="${escapeHtml(loginUrl)}">Se hvem du skal give gave til</a></p>`,
		"<p>Hvis du ikke allerede har været inde og oprette et password, vil du som det første blive bedt om at lave det.</p>",
		"<p>God jul, og god fornøjelse</p>",
		"<p>Julenissen</p>",
	].join("\n");

	return { subject, text, html };
};
