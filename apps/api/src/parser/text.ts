const DIACRITICS = /\p{Diacritic}/gu;
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const SPACES = /\s+/g;

// Accent-insensitive, case-insensitive, and free of decorations, so "EXPERIÊNCIA:" and
// "experiencia" compare equal.
export const normalise = (text: string): string =>
  text.normalize("NFD").replace(DIACRITICS, "").toLowerCase().replace(EDGE_PUNCTUATION, "").replace(SPACES, " ").trim();

export const wordsOf = (line: string): string[] => line.trim().split(SPACES).filter((word) => word.length > 0);

const hasLetters = (text: string): boolean => /\p{L}/u.test(text);
const hasLowercase = (text: string): boolean => /\p{Ll}/u.test(text);

export const isAllCaps = (line: string): boolean => hasLetters(line) && !hasLowercase(line);

export const isBlank = (line: string | undefined): boolean => line === undefined || line.trim().length === 0;
