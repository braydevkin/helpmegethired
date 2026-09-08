import type { DraftLanguage, Field } from "@helpmegethired/shared";

import { hasLevelWord, isLevelWord } from "./dictionaries/language-levels";
import { hasLetters, wordsOf } from "./text";

const PIECE_SEPARATOR = /\s*[;,|·•]\s*/u;
const LEVEL_SEPARATOR = /\s+[-–—]\s+|:\s*|\s*\(/u;
const PIECE_MAX_WORDS = 6;

const field = <Value>(value: Value, confidence: Field<Value>["confidence"]): Field<Value> => ({ value, confidence });

const medium = (value: string): Field<string> => field(value, "medium");

const count = (text: string, character: string): number => [...text].filter((each) => each === character).length;

// Only an unmatched parenthesis is a leftover of the split: "Fluente (C1)" keeps its pair.
function trimmed(text: string): string {
  let result = text.trim();

  while (result.startsWith("(") && count(result, "(") > count(result, ")")) {
    result = result.slice(1).trim();
  }

  while (result.endsWith(")") && count(result, ")") > count(result, "(")) {
    result = result.slice(0, -1).trim();
  }

  return result;
}

// "Inglês - Fluente (C1)" and "English (Fluent)" split at the first separator; the part after
// it is the level only when a level word or a CEFR code makes it one.
function withSeparator(piece: string): DraftLanguage | undefined {
  const separator = LEVEL_SEPARATOR.exec(piece);

  if (!separator) {
    return undefined;
  }

  const name = trimmed(piece.slice(0, separator.index));
  const rest = trimmed(piece.slice(separator.index + separator[0].length));

  if (!hasLetters(name)) {
    return undefined;
  }

  return { name: medium(name), level: hasLevelWord(rest) ? medium(rest) : null };
}

// "Inglês fluente" keeps the level words apart from the name.
function withoutSeparator(piece: string): DraftLanguage | undefined {
  const words = wordsOf(piece);
  const level = words.filter(isLevelWord);
  const name = words.filter((word) => !isLevelWord(word)).join(" ");

  if (!hasLetters(name)) {
    return undefined;
  }

  return { name: medium(trimmed(name)), level: level.length > 0 ? medium(trimmed(level.join(" "))) : null };
}

const languageOf = (piece: string): DraftLanguage | undefined =>
  wordsOf(piece).length <= PIECE_MAX_WORDS ? (withSeparator(piece) ?? withoutSeparator(piece)) : undefined;

export function extractLanguages(lines: readonly string[]): DraftLanguage[] {
  return lines
    .flatMap((line) => line.split(PIECE_SEPARATOR))
    .map((piece) => piece.trim())
    .filter((piece) => hasLetters(piece))
    .flatMap((piece) => {
      const language = languageOf(piece);

      return language ? [language] : [];
    });
}
