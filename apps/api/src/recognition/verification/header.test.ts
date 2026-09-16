import type { SegmentRecognition } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import type { RecognizedHeader } from "../../profile/segments/recognized";
import { verifyHeader } from "./header";

const quoted = (value: string, quote = value) => ({ value, quote });

describe("verifyHeader", () => {
  const lines = [
    "Ada Lovelace",
    "Senior Backend Engineer",
    "London | ada.lovelace@example.com",
    "linkedin.com/in/ada-lovelace-example · github.com/ada-example",
    "Backend engineer with ten years building queues.",
  ];
  const byRules: RecognizedHeader = {
    basicProfile: {
      headline: { value: "Senior Backend Engineer", confidence: "medium" },
      summary: { value: "Backend engineer with ten years building queues.", confidence: "low" },
      linkedinUrl: { value: "https://linkedin.com/in/ada-lovelace-example", confidence: "high" },
      githubUrl: null,
    },
    accountMismatch: { name: true, email: false },
  };

  it("verifies the Basic Profile fields and leaves the Account comparison to the rules", () => {
    const byModel: SegmentRecognition<"header"> = {
      headline: quoted("Senior Backend Engineer"),
      summary: quoted("Backend engineer with ten years building queues."),
      linkedinUrl: quoted("https://www.linkedin.com/in/ada-lovelace-example", "linkedin.com/in/ada-lovelace-example"),
      githubUrl: quoted("https://github.com/ada-example", "github.com/ada-example"),
    };

    expect(verifyHeader(lines, byRules, byModel)).toEqual({
      basicProfile: {
        headline: { value: "Senior Backend Engineer", confidence: "high" },
        summary: { value: "Backend engineer with ten years building queues.", confidence: "high" },
        linkedinUrl: { value: "https://linkedin.com/in/ada-lovelace-example", confidence: "high" },
        githubUrl: { value: "https://github.com/ada-example", confidence: "high" },
      },
      accountMismatch: { name: true, email: false },
    });
  });

  it("never takes the name or a contact line as the headline or the summary", () => {
    const byModel: SegmentRecognition<"header"> = {
      headline: quoted("Ada Lovelace"),
      summary: quoted("London | ada.lovelace@example.com"),
      linkedinUrl: null,
      githubUrl: null,
    };
    const withoutHeadline: RecognizedHeader = { ...byRules, basicProfile: { ...byRules.basicProfile, headline: null, summary: null } };

    expect(verifyHeader(lines, withoutHeadline, byModel)).toEqual(withoutHeadline);
  });

  it("discards an invented headline and keeps the rules' one", () => {
    const byModel: SegmentRecognition<"header"> = { headline: quoted("Staff Engineer"), summary: null, linkedinUrl: null, githubUrl: null };

    expect(verifyHeader(lines, byRules, byModel)).toEqual(byRules);
  });
});
