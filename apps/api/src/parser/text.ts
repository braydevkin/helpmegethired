const DIACRITICS = /\p{Diacritic}/gu;
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const SPACES = /\s+/g;

// Accent-insensitive, case-insensitive, and free of decorations, so "EXPERIÊNCIA:" and
// "experiencia" compare equal.
export const normalise = (text: string): string =>
  text.normalize("NFD").replace(DIACRITICS, "").toLowerCase().replace(EDGE_PUNCTUATION, "").replace(SPACES, " ").trim();

export const wordsOf = (line: string): string[] => line.trim().split(SPACES).filter((word) => word.length > 0);

// A cased character is one whose upper and lower forms differ; no pattern runs over the text.
export const hasLetters = (text: string): boolean => [...text].some((character) => character.toLowerCase() !== character.toUpperCase());
const hasLowercase = (text: string): boolean => /\p{Ll}/u.test(text);

export const isAllCaps = (line: string): boolean => hasLetters(line) && !hasLowercase(line);

export const isBlank = (line: string | undefined): boolean => line === undefined || line.trim().length === 0;

// Strips the given characters from the end without a pattern that scans back over the line.
export function trimTrailing(text: string, characters: string): string {
  let end = text.length;

  while (end > 0 && characters.includes(text[end - 1] ?? "")) {
    end -= 1;
  }

  return text.slice(0, end);
}
