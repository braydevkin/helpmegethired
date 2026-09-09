import { describe, expect, it } from "vitest";

import { toAccount, type AccountColumns } from "./account.mapper";

const row: AccountColumns = {
  id: "3f1c2a6e-7b8d-4c9e-a0f1-2b3c4d5e6f70",
  email: "ada@example.com",
  name: "Ada",
  last_name: "Lovelace",
  phone_country_code: "+44",
  phone_number: "7700900123",
  address: null,
  created_at: new Date("2026-09-04T10:00:00.000Z"),
};

describe("toAccount", () => {
  it("maps a stored phone into the shared Phone shape", () => {
    expect(toAccount(row).phone).toEqual({ countryCode: "+44", number: "7700900123" });
  });

  it("leaves the phone empty when either part is missing", () => {
    expect(toAccount({ ...row, phone_number: null }).phone).toBeNull();
    expect(toAccount({ ...row, phone_country_code: null }).phone).toBeNull();
  });

  it("leaves the phone empty instead of failing when the stored dial code is no longer supported", () => {
    expect(toAccount({ ...row, phone_country_code: "+999" }).phone).toBeNull();
  });

  it("serialises the creation date as ISO 8601", () => {
    expect(toAccount(row).createdAt).toBe("2026-09-04T10:00:00.000Z");
  });
});
