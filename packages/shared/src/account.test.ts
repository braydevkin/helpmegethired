import { describe, expect, it } from "vitest";

import { AccountInformationSchema, AccountSchema, PhoneSchema } from "./account.js";
import { account } from "./candidate.fixtures.js";

const information = {
  name: "Ada",
  lastName: "Lovelace",
  phone: { countryCode: "+44", number: "7700900123" },
  address: "London, UK",
};

describe("AccountSchema", () => {
  it("accepts an Account without identity information", () => {
    expect(AccountSchema.safeParse(account).success).toBe(true);
  });

  it("accepts an Account with identity information", () => {
    expect(AccountSchema.safeParse({ ...account, ...information }).success).toBe(true);
  });

  it.each([
    ["a malformed email", { ...account, email: "ada-at-example.com" }],
    ["a non-uuid id", { ...account, id: "account-1" }],
    ["a date without time", { ...account, createdAt: "2026-09-02" }],
    ["a missing name field", { ...account, name: undefined }],
    ["an unknown dial code", { ...account, phone: { countryCode: "+999", number: "7700900123" } }],
  ])("rejects %s", (_label, input) => {
    expect(AccountSchema.safeParse(input).success).toBe(false);
  });
});

describe("PhoneSchema", () => {
  it("keeps only the digits of the number", () => {
    expect(PhoneSchema.parse({ countryCode: "+351", number: "(912) 345-678" })).toEqual({
      countryCode: "+351",
      number: "912345678",
    });
  });

  it.each([
    ["fewer than six digits", { countryCode: "+351", number: "12345" }, "Enter a phone number we can reach you on"],
    ["letters", { countryCode: "+351", number: "9123456ab" }, "Enter a phone number we can reach you on"],
    ["an unknown dial code", { countryCode: "+999", number: "912345678" }, "Choose a country code"],
  ])("rejects %s", (_label, input, message) => {
    const result = PhoneSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).join("\n")).toContain(message);
  });
});

describe("AccountInformationSchema", () => {
  it("accepts the identity fields and trims them", () => {
    expect(AccountInformationSchema.parse({ ...information, name: " Ada ", address: " London, UK " })).toEqual(
      information,
    );
  });

  it.each([
    ["an omitted address", { ...information, address: undefined }],
    ["a null address", { ...information, address: null }],
    ["a blank address", { ...information, address: "   " }],
  ])("stores %s as null", (_label, input) => {
    expect(AccountInformationSchema.parse(input).address).toBeNull();
  });

  it.each([
    ["a blank name", { ...information, name: "  " }, "Name is required"],
    ["a missing last name", { ...information, lastName: undefined }, "Last name is required"],
    ["an overlong name", { ...information, name: "x".repeat(101) }, "at most 100 characters"],
    ["a missing phone", { ...information, phone: undefined }, "expected object"],
  ])("rejects %s with a readable message", (_label, input, message) => {
    const result = AccountInformationSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).join("\n").toLowerCase()).toContain(
      message.toLowerCase(),
    );
  });
});
