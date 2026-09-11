import type { ProfilePart, ReviewFlag } from "@helpmegethired/shared";

export interface ReviewNotice {
  title: string;
  detail: string;
}

const HIGH_CONFIDENCE = "Everything else was extracted with high confidence.";

// Only the two the split by capital would spell wrong; every other field reads as written.
const FIELD_LABELS: Readonly<Record<string, string>> = { githubUrl: "GitHub URL", linkedinUrl: "LinkedIn URL" };

const labelOf = (field: string): string => FIELD_LABELS[field] ?? field.replace(/([A-Z])/gu, " $1").toLowerCase();

const capitalized = (sentence: string): string => sentence.charAt(0).toUpperCase() + sentence.slice(1);

const quoted = (entry: string): string => `“${entry}”`;

const key = (part: ProfilePart, field: string): string => `${part}.${field}`;

// The clauses the design writes out; every other flagged field reads by its own name.
const CLAUSES: ReadonlyMap<string, (entry: string) => string> = new Map([
  [key("experience", "period"), (entry: string) => `the dates on ${quoted(entry)} look ambiguous`],
  [key("experience", "company"), (entry: string) => `the company on ${quoted(entry)} could not be split from the title`],
  [key("education", "degree"), (entry: string) => `the degree on ${quoted(entry)} is unclear`],
]);

const NOTES: ReadonlyMap<string, string> = new Map([
  [key("experience", "period"), "Dates need confirming — the PDF lists only years."],
  [key("experience", "company"), "The company needs confirming — the PDF lists it with the title."],
  [key("education", "degree"), "The degree needs confirming — the PDF spells it out unclearly."],
]);

function clauseOf(flag: ReviewFlag): string {
  if (flag.reason === "account_mismatch") {
    return `the ${labelOf(flag.field)} in your PDF is not the one on your account`;
  }

  if (flag.entry === null) {
    return `your ${labelOf(flag.field)} needs a second look`;
  }

  const clause = CLAUSES.get(key(flag.part, flag.field));

  return clause ? clause(flag.entry) : `the ${labelOf(flag.field)} on ${quoted(flag.entry)} needs a second look`;
}

// "a", "a, and b", "a, b, and c": one clause per flagged field, as the design writes it.
const listed = (clauses: readonly string[]): string =>
  clauses.length === 1 ? clauses.join("") : `${clauses.slice(0, -1).join(", ")}, and ${clauses.at(-1) ?? ""}`;

// Every flagged field in one sentence, as the Profile's notice and the analysis gate write it.
export const reviewSummaryOf = (flags: readonly ReviewFlag[]): string => capitalized(listed(flags.map(clauseOf)));

// The notice above the Profile: how many fields were recognized with low confidence, and
// what each of them is. A Profile with nothing to look at has no notice.
export function reviewNoticeOf(flags: readonly ReviewFlag[]): ReviewNotice | null {
  if (flags.length === 0) {
    return null;
  }

  const subject = flags.length === 1 ? "1 field needs" : `${flags.length} fields need`;

  return { title: `${subject} your eyes`, detail: `${reviewSummaryOf(flags)}. ${HIGH_CONFIDENCE}` };
}

// What one entry says in place, so the Candidate reads the flag where the value is.
export function reviewNoteOf(flags: readonly ReviewFlag[], part: ProfilePart, entry: string): string | null {
  const notes = flags
    .filter((flag) => flag.part === part && flag.entry === entry)
    .map((flag) => NOTES.get(key(flag.part, flag.field)) ?? `${capitalized(labelOf(flag.field))} needs confirming.`);

  return notes.length > 0 ? notes.join(" ") : null;
}
