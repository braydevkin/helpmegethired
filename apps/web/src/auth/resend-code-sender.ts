import { renderCodeEmail } from "./code-email";
import type { CodeDelivery, CodeSender } from "./code-sender";

export const RESEND_EMAILS_ENDPOINT = "https://api.resend.com/emails";

export interface ResendCodeSenderOptions {
  apiKey: string;
  from: string;
  fetch?: typeof globalThis.fetch;
}

export class CodeEmailRejectedError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Resend refused the verification code email with status ${status}: ${detail}`);
    this.name = "CodeEmailRejectedError";
  }
}

export class ResendCodeSender implements CodeSender {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly fetch: typeof globalThis.fetch;

  constructor({ apiKey, from, fetch = globalThis.fetch }: ResendCodeSenderOptions) {
    this.apiKey = apiKey;
    this.from = from;
    this.fetch = fetch;
  }

  async send({ email, code }: CodeDelivery): Promise<void> {
    const { subject, text, html } = renderCodeEmail(code);
    const response = await this.fetch(RESEND_EMAILS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to: email, subject, text, html }),
    });

    if (!response.ok) {
      throw new CodeEmailRejectedError(response.status, await describeFailure(response));
    }
  }
}

async function describeFailure(response: Response): Promise<string> {
  const body = (await response.json().catch(() => undefined)) as { message?: unknown } | undefined;

  return typeof body?.message === "string" ? body.message : response.statusText || "no details";
}
