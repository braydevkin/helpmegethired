import { describe, expect, it } from "vitest";

import { DevelopmentCodeSender } from "./development-code-sender";
import { ResendCodeSender } from "./resend-code-sender";
import { MissingCodeSenderError, selectCodeSender } from "./select-code-sender";

const resend = { AUTH_RESEND_KEY: "re_test_key", EMAIL_FROM: "no-reply@example.com" };

describe("selectCodeSender", () => {
  it.each(["development", "test"] as const)("logs the code in %s without a Resend key", (NODE_ENV) => {
    expect(selectCodeSender({ NODE_ENV })).toBeInstanceOf(DevelopmentCodeSender);
  });

  it.each(["development", "test", "production"] as const)("sends through Resend in %s when the key is set", (NODE_ENV) => {
    expect(selectCodeSender({ NODE_ENV, ...resend })).toBeInstanceOf(ResendCodeSender);
  });

  it("refuses to start in production without a real sender and names the variables", () => {
    expect(() => selectCodeSender({ NODE_ENV: "production" })).toThrow(MissingCodeSenderError);
    expect(() => selectCodeSender({ NODE_ENV: "production" })).toThrow("set AUTH_RESEND_KEY and EMAIL_FROM");
  });
});
