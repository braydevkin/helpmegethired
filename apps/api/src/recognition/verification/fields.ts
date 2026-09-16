import type { Confidence, Field, Period, QuotedPeriod } from "@helpmegethired/shared";

import { findDateRange } from "../../parser";
import { comparable, holdsWords, type SegmentText } from "./segment-text";

// A value the Model read and the Segment was found to hold, with the lines its quote spans.
export interface Reading<Value> {
  value: Value;
  quote: string;
  lines: number[];
}

interface Quoted<Value> {
  value: Value;
  quote: string;
}

const readingAt = <Value>(text: SegmentText, value: Value, quote: string): Reading<Value> | null => {
  const lines = text.linesOf(quote);

  return lines ? { value, quote, lines } : null;
};

export const quotedReadingOf = <Value>(text: SegmentText, quoted: Quoted<Value> | null): Reading<Value> | null =>
  quoted ? readingAt(text, quoted.value, quoted.quote) : null;

// A text value must be said by its own quote, so a real quote cannot carry an invented value
// nor one read from elsewhere in the Segment.
export const textReadingOf = (text: SegmentText, quoted: Quoted<string> | null): Reading<string> | null =>
  quoted && holdsWords(quoted.quote, quoted.value) ? quotedReadingOf(text, quoted) : null;

export const periodReadingOf = (text: SegmentText, quoted: QuotedPeriod | null): Reading<Period> | null =>
  quoted && (quoted.end === null || quoted.end >= quoted.start) ? readingAt(text, { start: quoted.start, end: quoted.end }, quoted.quote) : null;

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

// Only a web address is a link a Profile may show.
export const urlReadingOf = (text: SegmentText, quoted: Quoted<string> | null): Reading<string> | null =>
  quoted && URL.canParse(quoted.value) && WEB_PROTOCOLS.has(new URL(quoted.value).protocol) ? quotedReadingOf(text, quoted) : null;

// How the rules judge one kind of field: when the two readings say the same, which one wins a
// disagreement, and whether a dictionary or a pattern confirms the Model's value on its own.
export interface FieldRule<Value> {
  agree(byRules: Value, byModel: Reading<Value>): boolean;
  trusted: "rules" | "model";
  confirms(reading: Reading<Value>): boolean;
}

// Text is what a Model reads better than the rules' separators, so the Model's value wins a
// disagreement; the Candidate is asked to review it either way.
export const textRule = (confirms: (value: string) => boolean = () => false): FieldRule<string> => ({
  agree: (byRules, byModel) => comparable(byRules) === comparable(byModel.value),
  trusted: "model",
  confirms: (reading) => confirms(reading.value),
});

const samePeriod = (left: Period, right: Period): boolean => left.start === right.start && left.end === right.end;

const periodSaidBy = (quote: string): Period | undefined => findDateRange(quote)?.period;

// A quote that says only years, as "2014 – 2016", agrees with the rules' reading of those years
// whatever months the Model filled in.
export const periodRule: FieldRule<Period> = {
  agree: (byRules, { value, quote }) => {
    const said = periodSaidBy(quote);

    return samePeriod(byRules, value) || (said !== undefined && samePeriod(byRules, said));
  },
  trusted: "rules",
  confirms: ({ value, quote }) => {
    const said = periodSaidBy(quote);

    return said !== undefined && samePeriod(said, value);
  },
};

const SCHEME_AND_WWW = /^(?:https?:\/\/)?(?:www\.)?/iu;
const TRAILING_SLASHES = /\/+$/u;
const TRAILING_PUNCTUATION = /[.,;:)\]]+$/u;

const urlKey = (url: string): string => url.toLowerCase().replace(SCHEME_AND_WWW, "").replace(TRAILING_SLASHES, "");

const urlKeysIn = (quote: string): string[] => quote.split(/\s+/u).map((token) => urlKey(token.replace(TRAILING_PUNCTUATION, "")));

export const urlRule: FieldRule<string> = {
  agree: (byRules, byModel) => urlKey(byRules) === urlKey(byModel.value),
  trusted: "rules",
  confirms: ({ value, quote }) => urlKeysIn(quote).includes(urlKey(value)),
};

const YEARS = /(?<!\d)\d{4}(?!\d)/gu;

export const yearRule: FieldRule<number> = {
  agree: (byRules, byModel) => byRules === byModel.value,
  trusted: "rules",
  confirms: ({ value, quote }) => [...quote.matchAll(YEARS)].some((year) => Number(year[0]) === value),
};

const fieldOf = <Value>(value: Value, confidence: Confidence): Field<Value> => ({ value, confidence });

// Agreement is high and keeps the rules' verbatim value; a value only the Model read is high when
// a rule confirms it and medium otherwise; a disagreement is low and keeps the trusted side.
export function verifiedField<Value>(byRules: Field<Value> | null, byModel: Reading<Value>, rule: FieldRule<Value>): Field<Value>;
export function verifiedField<Value>(byRules: Field<Value> | null, byModel: Reading<Value> | null, rule: FieldRule<Value>): Field<Value> | null;
export function verifiedField<Value>(byRules: Field<Value> | null, byModel: Reading<Value> | null, rule: FieldRule<Value>): Field<Value> | null {
  if (byModel === null) {
    return byRules;
  }

  if (byRules === null) {
    return fieldOf(byModel.value, rule.confirms(byModel) ? "high" : "medium");
  }

  if (rule.agree(byRules.value, byModel)) {
    return fieldOf(byRules.value, "high");
  }

  return fieldOf(rule.trusted === "rules" ? byRules.value : byModel.value, "low");
}
