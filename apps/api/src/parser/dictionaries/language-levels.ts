import { normalise } from "../text";

// Level words and CEFR codes as they read after normalisation, in Portuguese and English.
export const LANGUAGE_LEVEL_WORDS: readonly string[] = [
  "nativo",
  "nativa",
  "native",
  "materna",
  "fluente",
  "fluent",
  "avancado",
  "avancada",
  "advanced",
  "intermediario",
  "intermediaria",
  "intermediate",
  "basico",
  "basica",
  "basic",
  "beginner",
  "iniciante",
  "elementary",
  "elementar",
  "proficiente",
  "proficient",
  "proficiency",
  "profissional",
  "professional",
  "bilingue",
  "bilingual",
  "conversacao",
  "conversational",
  "a1",
  "a2",
  "b1",
  "b2",
  "c1",
  "c2",
];

const levelWords = new Set(LANGUAGE_LEVEL_WORDS);

export const wordsOfLevel = (text: string): string[] => normalise(text).split(/[^\p{L}\p{N}]+/u);

export const isLevelWord = (word: string): boolean => levelWords.has(normalise(word).replace(/[^\p{L}\p{N}]/gu, ""));

export const hasLevelWord = (text: string): boolean => wordsOfLevel(text).some((word) => levelWords.has(word));
