import type { Account, BasicProfile } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { contactRowsOf } from "./contact";

const account: Account = {
  id: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  email: "ada@example.com",
  name: "Ada",
  lastName: "Lovelace",
  phone: { countryCode: "+351", number: "912345678" },
  address: "Lisbon, Portugal",
  createdAt: "2026-09-02T10:00:00.000Z",
};

const basicProfile: BasicProfile = {
  headline: "Backend engineer",
  summary: null,
  linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
  githubUrl: "https://github.com/ada/",
};

describe("contactRowsOf", () => {
  it("takes the e-mail, phone, and address from the Account and the two URLs from the Basic Profile", () => {
    expect(contactRowsOf(account, basicProfile)).toEqual([
      { label: "E-mail", value: "ada@example.com" },
      { label: "Phone", value: "+351 912345678" },
      { label: "GitHub", value: "github.com/ada", href: "https://github.com/ada/" },
      { label: "LinkedIn", value: "www.linkedin.com/in/ada-lovelace", href: "https://www.linkedin.com/in/ada-lovelace" },
      { label: "Address", value: "Lisbon, Portugal" },
    ]);
  });

  it("says what was never given apart from what the PDF did not hold", () => {
    const rows = contactRowsOf({ ...account, phone: null, address: null }, { ...basicProfile, githubUrl: null, linkedinUrl: null });

    expect(rows.filter((row) => row.missing)).toEqual([
      { label: "Phone", value: "Not given yet", missing: true },
      { label: "GitHub", value: "Not found in your PDF", missing: true },
      { label: "LinkedIn", value: "Not found in your PDF", missing: true },
      { label: "Address", value: "Not given yet", missing: true },
    ]);
  });
});
