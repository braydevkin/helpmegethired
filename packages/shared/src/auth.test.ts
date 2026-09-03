import { describe, expect, it } from "vitest";

import { SendCodeSchema, VerifyCodeSchema } from "./auth.js";

const email = "ada@example.com";

describe("SendCodeSchema", () => {
  it("accepts an email", () => {
    expect(SendCodeSchema.safeParse({ email })).toEqual({ success: true, data: { email } });
  });

  it("normalises the email by trimming and lowercasing it", () => {
    expect(SendCodeSchema.parse({ email: "  Ada@Example.COM " }).email).toBe(email);
  });

  it.each([
    ["a malformed email", { email: "ada-at-example.com" }, "Enter a valid email address"],
    ["a missing email", {}, "Email is required"],
  ])("rejects %s with a readable message", (_label, input, message) => {
    const result = SendCodeSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).join("\n")).toContain(message);
  });
});

describe("VerifyCodeSchema", () => {
  it("accepts an email and a six digit code", () => {
    expect(VerifyCodeSchema.safeParse({ email, code: "123456" })).toEqual({
      success: true,
      data: { email, code: "123456" },
    });
  });

  it("trims the code", () => {
    expect(VerifyCodeSchema.parse({ email, code: " 123456 " }).code).toBe("123456");
  });

  it.each([
    ["a short code", { email, code: "12345" }, "Enter all 6 digits of your code"],
    ["a long code", { email, code: "1234567" }, "Enter all 6 digits of your code"],
    ["letters", { email, code: "12a456" }, "Enter all 6 digits of your code"],
    ["a missing code", { email }, "Code is required"],
    ["a malformed email", { email: "ada", code: "123456" }, "Enter a valid email address"],
  ])("rejects %s with a readable message", (_label, input, message) => {
    const result = VerifyCodeSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).join("\n")).toContain(message);
  });
});
