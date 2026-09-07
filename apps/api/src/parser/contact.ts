import type { Field } from "@helpmegethired/shared";

import { sectionKindOf } from "./dictionaries/section-headers";
import { normalise, wordsOf } from "./text";

export interface Contact {
  name: Field<string> | null;
  email: Field<string> | null;
  phone: Field<string> | null;
  linkedinUrl: Field<string> | null;
  githubUrl: Field<string> | null;
  otherUrls: Field<string>[];
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/u;
const BRAZILIAN_PHONE = /(?<!\d)(\+?55\s?)?\(?\d{2}\)?\s?9?\s?\d{4}[-.\s]?\d{4}(?!\d)/;
const INTERNATIONAL_PHONE = /(?<!\d)\+\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}(?!\d)/;
const LINKEDIN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[\p{L}\p{N}%._-]+/iu;
const GITHUB = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\p{L}\p{N}._-]+/iu;
const ANY_URL = /(?:https?:\/\/|www\.)[^\s)>\]]+/giu;
const SOME_URL = /(?:https?:\/\/|www\.)[^\s)>\]]+/iu;
const TRAILING_URL_PUNCTUATION = /[.,;:)\]/]+$/u;

const NAME_MIN_WORDS = 2;
const NAME_MAX_WORDS = 5;
const NAME_CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e", "di", "van", "von", "der", "del", "la", "le"]);

const high = (value: string): Field<string> => ({ value, confidence: "high" });

const asUrl = (match: string): string => {
  const bare = match.replace(TRAILING_URL_PUNCTUATION, "");

  return /^https?:\/\//iu.test(bare) ? bare : `https://${bare.replace(/^www\./iu, "www.")}`;
};

const first = (text: string, pattern: RegExp): string | undefined => pattern.exec(text)?.[0];

const isNameWord = (word: string): boolean =>
  NAME_CONNECTORS.has(word.toLowerCase()) || (/^\p{Lu}[\p{L}'.-]*$/u.test(word) && !/\d/u.test(word));

const isHeadingWord = (word: string): boolean => sectionKindOf(normalise(word)) !== undefined;

// Two headings side by side, as two columns produce, read like a name and are not one.
export const looksLikeName = (line: string): boolean => {
  const words = wordsOf(line);

  return (
    words.length >= NAME_MIN_WORDS &&
    words.length <= NAME_MAX_WORDS &&
    !/[@\d|:]/u.test(line) &&
    sectionKindOf(normalise(line)) === undefined &&
    words.every(isNameWord) &&
    words.some((word) => !NAME_CONNECTORS.has(word.toLowerCase())) &&
    !words.every(isHeadingWord)
  );
};

export const isContactLine = (line: string): boolean =>
  EMAIL.test(line) || BRAZILIAN_PHONE.test(line) || INTERNATIONAL_PHONE.test(line) || SOME_URL.test(line);

// The name is the first header line that reads like one: two to five capitalised words, no
// digit, no "@". It is medium because a headline such as "Senior Software Engineer" reads
// the same way; the caller keeps the name out of the Profile either way.
function nameIn(headerLines: readonly string[]): Field<string> | null {
  const line = headerLines.find((candidate) => !isContactLine(candidate) && looksLikeName(candidate));

  return line ? { value: line.trim(), confidence: "medium" } : null;
}

export function extractContact(text: string, headerLines: readonly string[]): Contact {
  const email = first(text, EMAIL);
  const phone = first(text, INTERNATIONAL_PHONE) ?? first(text, BRAZILIAN_PHONE);
  const linkedin = first(text, LINKEDIN);
  const github = first(text, GITHUB);
  const otherUrls = [...text.matchAll(ANY_URL)]
    .map((match) => asUrl(match[0]))
    .filter((url) => !LINKEDIN.test(url) && !GITHUB.test(url));

  return {
    name: nameIn(headerLines),
    email: email ? high(email) : null,
    phone: phone ? high(phone.trim()) : null,
    linkedinUrl: linkedin ? high(asUrl(linkedin)) : null,
    githubUrl: github ? high(asUrl(github)) : null,
    otherUrls: [...new Set(otherUrls)].map(high),
  };
}
