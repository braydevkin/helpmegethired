import { describe, expect, it } from "vitest";

import { extractContact, isContactLine, looksLikeName } from "./contact";

const header = ["Ana Clara de Souza", "Engenheira de Software Sênior", "São Paulo, SP | (11) 98765-4321 | ana.souza@example.com"];
const text = [...header, "", "linkedin.com/in/ana-clara-souza · github.com/anaclara", "Portfolio: https://anaclara.dev/", "Experience"].join("\n");

describe("extractContact", () => {
  it("finds the e-mail, the phone, and the two profile URLs with high confidence", () => {
    expect(extractContact(text, header)).toEqual({
      name: { value: "Ana Clara de Souza", confidence: "medium" },
      email: { value: "ana.souza@example.com", confidence: "high" },
      phone: { value: "(11) 98765-4321", confidence: "high" },
      linkedinUrl: { value: "https://linkedin.com/in/ana-clara-souza", confidence: "high" },
      githubUrl: { value: "https://github.com/anaclara", confidence: "high" },
      otherUrls: [{ value: "https://anaclara.dev", confidence: "high" }],
    });
  });

  it.each([
    ["+55 11 98765-4321", "+55 11 98765-4321"],
    ["+1 (415) 555-0199", "+1 (415) 555-0199"],
    ["+44 20 7946 0958", "+44 20 7946 0958"],
    ["11 3456-7890", "11 3456-7890"],
  ])("reads the phone %s", (line, phone) => {
    expect(extractContact(`Ada\n${line}`, ["Ada"]).phone).toEqual({ value: phone, confidence: "high" });
  });

  it("never mistakes a period of years for a phone", () => {
    expect(extractContact("Acme\n2019 - 2021\n2017 to 2019", ["Acme"]).phone).toBeNull();
  });

  it("keeps a full LinkedIn URL as it is and prefixes a bare one", () => {
    expect(extractContact("https://www.linkedin.com/in/ada-lovelace/", []).linkedinUrl?.value).toBe("https://www.linkedin.com/in/ada-lovelace");
    expect(extractContact("br.linkedin.com/in/ada", []).linkedinUrl?.value).toBe("https://br.linkedin.com/in/ada");
  });

  it("answers null for every field it cannot find", () => {
    expect(extractContact("Nothing here", ["Nothing here"])).toEqual({
      name: null,
      email: null,
      phone: null,
      linkedinUrl: null,
      githubUrl: null,
      otherUrls: [],
    });
  });
});

describe("looksLikeName", () => {
  it.each(["Ada Lovelace", "Ana Clara de Souza", "João Pedro dos Santos", "Grace Brewster Murray Hopper"])("accepts %s", (line) => {
    expect(looksLikeName(line)).toBe(true);
  });

  it.each(["Ada", "Senior Software Engineer at Acme Corp Ltd", "ada@example.com", "Engineer 2", "Experience", "Backend | Node.js", "SUMMARY EDUCATION"])(
    "refuses %s",
    (line) => {
      expect(looksLikeName(line)).toBe(false);
    },
  );
});

describe("isContactLine", () => {
  it("recognises lines that carry contact details", () => {
    expect(isContactLine("ada@example.com")).toBe(true);
    expect(isContactLine("www.ada.dev")).toBe(true);
    expect(isContactLine("Backend engineer")).toBe(false);
  });
});
