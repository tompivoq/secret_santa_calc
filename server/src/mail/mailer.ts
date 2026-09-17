export interface MailMessage {
	to: string;
	subject: string;
	html: string;
	/** Plain-text alternative. Always send one — some clients show only this. */
	text: string;
}

/**
 * Sending an email, narrow enough that swapping provider means writing one
 * of these and nothing else, and that tests can substitute a fake instead
 * of sending anything. Throws on failure; callers decide whether one
 * recipient failing should stop the rest.
 */
export interface Mailer {
	send(message: MailMessage): Promise<void>;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Sends through Resend's HTTP API. Deliberately not their SDK: this is one
 * POST with a bearer token, and a dependency that has to be kept updated
 * and audited is a poor trade for the few lines it would save.
 */
export const createResendMailer = (apiKey: string, from: string): Mailer => ({
	async send(message) {
		const response = await fetch(RESEND_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from,
				to: [message.to],
				subject: message.subject,
				html: message.html,
				text: message.text,
			}),
		});

		if (!response.ok) {
			// Resend puts the reason in the body; without it the caller is left
			// guessing between a bad key, an unverified domain and a typo'd address.
			// In Danish because it's shown to the admin as-is; the detail after
			// the colon is Resend's own wording and stays English.
			const detail = await response.text().catch(() => "");
			throw new Error(`Resend afviste e-mailen (${response.status}): ${detail}`);
		}
	},
});

/**
 * Writes emails to the console instead of sending them — what runs in
 * local dev, where there's no API key and no desire to send real mail to
 * real relatives while testing.
 */
export const createLoggingMailer = (log: (line: string) => void = console.log): Mailer => ({
	send(message) {
		log(`[mail] would send to ${message.to}: ${message.subject}\n${message.text}`);
		return Promise.resolve();
	},
});

export interface MailConfig {
	RESEND_API_KEY?: string | undefined;
	MAIL_FROM?: string | undefined;
}

/**
 * Picks a mailer from the environment: a real one when an API key is
 * configured, otherwise the logging one.
 *
 * Falling back rather than refusing to start is deliberate — the app's
 * other features shouldn't be unreachable because email isn't set up yet
 * — but it's loud about it, since "emails were sent" and "emails were
 * printed to a log nobody reads" must never be confusable in production.
 */
export const createMailerFromEnv = (
	env: MailConfig = process.env,
	log: (line: string) => void = console.log,
): Mailer => {
	const from = env.MAIL_FROM;
	if (!env.RESEND_API_KEY || !from) {
		log("[mail] RESEND_API_KEY and/or MAIL_FROM are not set — emails will be logged, not sent.");
		return createLoggingMailer(log);
	}
	return createResendMailer(env.RESEND_API_KEY, from);
};
