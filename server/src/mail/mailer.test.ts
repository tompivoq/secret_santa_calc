import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createLoggingMailer,
	createMailerFromEnv,
	createResendMailer,
	type MailMessage,
} from "./mailer.js";

const MESSAGE: MailMessage = {
	to: "anna@example.com",
	subject: "Your match is ready",
	html: "<p>Your match is ready</p>",
	text: "Your match is ready",
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("the Resend mailer", () => {
	it("posts the message to Resend with the API key and sender", async () => {
		const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await createResendMailer("re_test_key", "Julenissen <santa@example.com>").send(MESSAGE);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://api.resend.com/emails");
		expect(init.method).toBe("POST");
		expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
		expect(JSON.parse(init.body as string)).toEqual({
			from: "Julenissen <santa@example.com>",
			to: ["anna@example.com"],
			subject: "Your match is ready",
			html: "<p>Your match is ready</p>",
			text: "Your match is ready",
		});
	});

	it("throws with the provider's explanation when the send is rejected", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response('{"message":"Domain is not verified"}', { status: 403 })),
		);

		// Not swallowed: the caller has to be able to tell the admin that this
		// person wasn't actually emailed, and why.
		await expect(
			createResendMailer("re_test_key", "santa@example.com").send(MESSAGE),
		).rejects.toThrow(/403.*Domain is not verified/);
	});
});

describe("the logging mailer", () => {
	it("logs the message instead of sending anything", async () => {
		const lines: string[] = [];
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await createLoggingMailer((line) => lines.push(line)).send(MESSAGE);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(lines[0]).toContain("anna@example.com");
		expect(lines[0]).toContain("Your match is ready");
	});
});

describe("choosing a mailer from the environment", () => {
	it("uses Resend when a key and sender are configured", async () => {
		const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await createMailerFromEnv(
			{ RESEND_API_KEY: "re_test_key", MAIL_FROM: "santa@example.com" },
			() => {},
		).send(MESSAGE);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("falls back to logging, loudly, when the key is missing", async () => {
		const lines: string[] = [];
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await createMailerFromEnv({ MAIL_FROM: "santa@example.com" }, (line) => lines.push(line)).send(
			MESSAGE,
		);

		expect(fetchMock).not.toHaveBeenCalled();
		// "Sent" and "written to a log nobody reads" must not be confusable.
		expect(lines.some((line) => line.includes("will be logged, not sent"))).toBe(true);
	});

	it("falls back to logging when the sender address is missing", async () => {
		const lines: string[] = [];
		vi.stubGlobal("fetch", vi.fn());

		createMailerFromEnv({ RESEND_API_KEY: "re_test_key" }, (line) => lines.push(line));

		expect(lines.some((line) => line.includes("will be logged, not sent"))).toBe(true);
	});
});
