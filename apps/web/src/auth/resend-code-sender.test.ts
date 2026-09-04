import { describe, expect, it, vi } from "vitest";

import { CodeEmailRejectedError, RESEND_EMAILS_ENDPOINT, ResendCodeSender } from "./resend-code-sender";

const delivery = { email: "ada@example.com", code: "482913", expiresAt: new Date("2026-09-03T10:10:00Z") };
const options = { apiKey: "re_test_key", from: "Help Me Get Hired <no-reply@example.com>" };

const respondWith = (status: number, body: unknown = {}) =>
  vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

const sentRequest = (fetch: ReturnType<typeof respondWith>) => {
  const [url, init] = fetch.mock.calls[0] as [string, RequestInit];

  return { url, init, body: JSON.parse(init.body as string) as Record<string, string> };
};

describe("ResendCodeSender", () => {
  it("posts the code email to Resend with the API key", async () => {
    const fetch = respondWith(200, { id: "email-id" });

    await new ResendCodeSender({ ...options, fetch }).send(delivery);

    const { url, init, body } = sentRequest(fetch);

    expect(url).toBe(RESEND_EMAILS_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer re_test_key", "Content-Type": "application/json" });
    expect(body.from).toBe(options.from);
    expect(body.to).toBe("ada@example.com");
    expect(body.subject).toContain("482913");
    expect(body.text).toContain("482913");
    expect(body.html).toContain("482913");
  });

  it("reports the status and the message when Resend refuses the email", async () => {
    const fetch = respondWith(403, { message: "The example.com domain is not verified" });
    const sender = new ResendCodeSender({ ...options, fetch });

    await expect(sender.send(delivery)).rejects.toThrow(CodeEmailRejectedError);
    await expect(sender.send(delivery)).rejects.toThrow(
      "Resend refused the verification code email with status 403: The example.com domain is not verified",
    );
  });

  it("still reports the status when the refusal has no readable body", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("gateway timeout", { status: 504 }));

    await expect(new ResendCodeSender({ ...options, fetch }).send(delivery)).rejects.toThrow("status 504");
  });

  it("lets a network failure propagate", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError("fetch failed"));

    await expect(new ResendCodeSender({ ...options, fetch }).send(delivery)).rejects.toThrow("fetch failed");
  });
});
