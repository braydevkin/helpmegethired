import { BasicProfileSchema, ExperienceCorrectionSchema, type BasicProfile, type ExperienceCorrection, type Period } from "@helpmegethired/shared";
import type { ZodType } from "zod";

export type CorrectionIssues = Record<string, string>;

// What a correction answers back to the page: saved, or refused with the words that belong to
// the whole form and to each field.
export interface CorrectionFailure {
  ok: false;
  message: string;
  issues?: CorrectionIssues;
}

export type CorrectionResult = { ok: true } | CorrectionFailure;

export type CorrectionAction = (previous: CorrectionResult | null, form: FormData) => Promise<CorrectionResult>;

export type FormReading<Value> = { ok: true; value: Value } | { ok: false; issues: CorrectionIssues };

// What the Candidate is told when a field does not pass its schema, in the words of the field
// rather than the words of the parser.
const MESSAGES: CorrectionIssues = {
  role: "Name the role this experience was for.",
  "period.start": "Give the month it started, as 2022-03.",
  "period.end": "Give the month it ended, as 2024-06, or leave it open.",
  linkedinUrl: "Give the full address, starting with https://.",
  githubUrl: "Give the full address, starting with https://.",
};

const FALLBACK_MESSAGE = "This is not something we can save yet.";

const textOf = (form: FormData, name: string): string | null => {
  const value = form.get(name);
  const text = typeof value === "string" ? value.trim() : "";

  return text === "" ? null : text;
};

const listOf = (form: FormData, name: string): string[] =>
  (textOf(form, name) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");

// Both ends empty means the entry carries no period at all; a missing start with an end given
// is a period the Candidate has to finish, and the schema says so.
const periodOf = (form: FormData): Period | null => {
  const start = textOf(form, "periodStart");
  const end = textOf(form, "periodEnd");

  return start === null && end === null ? null : { start: start ?? "", end };
};

function reading<Value>(schema: ZodType<Value>, fields: unknown): FormReading<Value> {
  const parsed = schema.safeParse(fields);

  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  const issues = parsed.error.issues.map((issue) => {
    const path = issue.path.join(".");

    return [path, MESSAGES[path] ?? FALLBACK_MESSAGE] as const;
  });

  return { ok: false, issues: Object.fromEntries(issues) };
}

export const basicProfileFrom = (form: FormData): FormReading<BasicProfile> =>
  reading(BasicProfileSchema, {
    headline: textOf(form, "headline"),
    summary: textOf(form, "summary"),
    linkedinUrl: textOf(form, "linkedinUrl"),
    githubUrl: textOf(form, "githubUrl"),
  });

export const experienceFrom = (form: FormData): FormReading<ExperienceCorrection> =>
  reading(ExperienceCorrectionSchema, {
    role: textOf(form, "role"),
    company: textOf(form, "company"),
    period: periodOf(form),
    description: textOf(form, "description"),
    skills: listOf(form, "skills"),
  });

export const entryIdFrom = (form: FormData): string | null => textOf(form, "id");
