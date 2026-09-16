const SPACES = /\s+/gu;
const DIACRITICS = /\p{Diacritic}/gu;
const NOT_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;
const ALPHANUMERIC = /[\p{L}\p{N}]/u;

const collapsed = (text: string): string => text.replace(SPACES, " ").trim().toLowerCase();

// Two texts that say the same words, whatever their case, accents, punctuation, and line breaks.
export const comparable = (text: string): string =>
  text.normalize("NFD").replace(DIACRITICS, "").toLowerCase().replace(NOT_ALPHANUMERIC, " ").trim();

export const wordsOf = (text: string): string[] => comparable(text).split(" ").filter((word) => word.length > 0);

// A value is held by a text that says its words in order, so "Acme Inc." is held by "ACME Inc"
// and "Engine" is not held by "Engines".
export function holdsWords(text: string, value: string): boolean {
  const needle = comparable(value);

  return needle.length > 0 && ` ${comparable(text)} `.includes(` ${needle} `);
}

const isAlphanumeric = (character: string | undefined): boolean => character !== undefined && ALPHANUMERIC.test(character);

interface LineStart {
  line: number;
  offset: number;
}

// The Segment's lines as the Model read them. A quote is searched verbatim except for case and
// whitespace, over the non-blank lines joined by one space, so a quote may run across lines, and
// it never starts or ends inside a word, so "Go" is not found in "Google".
export class SegmentText {
  private readonly searchable: string;
  private readonly starts: LineStart[] = [];

  constructor(lines: readonly string[]) {
    const parts: string[] = [];
    let offset = 0;

    lines.forEach((line, index) => {
      const part = collapsed(line);

      if (part.length > 0) {
        this.starts.push({ line: index, offset });
        parts.push(part);
        offset += part.length + 1;
      }
    });

    this.searchable = parts.join(" ");
  }

  // The indexes of the lines the quote's first whole occurrence spans, or undefined when the
  // Segment never says it.
  linesOf(quote: string): number[] | undefined {
    return this.occurrencesOf(quote)[0];
  }

  // The lines each whole occurrence of the quote spans, in the order the Segment says them.
  occurrencesOf(quote: string): number[][] {
    const needle = collapsed(quote);
    const occurrences: number[][] = [];
    let index = needle.length > 0 ? this.wholeOccurrenceFrom(needle, 0) : -1;

    while (index !== -1) {
      occurrences.push(this.linesSpannedBy(index, needle.length));
      index = this.wholeOccurrenceFrom(needle, index + needle.length);
    }

    return occurrences;
  }

  private linesSpannedBy(index: number, length: number): number[] {
    const first = this.lineAt(index);
    const last = this.lineAt(index + length - 1);

    return Array.from({ length: last - first + 1 }, (_, step) => first + step);
  }

  private wholeOccurrenceFrom(needle: string, from: number): number {
    const startsInWord = isAlphanumeric(needle[0]);
    const endsInWord = isAlphanumeric(needle.at(-1));
    let index = this.searchable.indexOf(needle, from);

    while (index !== -1) {
      const cutBefore = startsInWord && isAlphanumeric(this.searchable[index - 1]);
      const cutAfter = endsInWord && isAlphanumeric(this.searchable[index + needle.length]);

      if (!cutBefore && !cutAfter) {
        return index;
      }

      index = this.searchable.indexOf(needle, index + 1);
    }

    return -1;
  }

  private lineAt(offset: number): number {
    let line = this.starts[0]?.line ?? 0;

    for (const start of this.starts) {
      if (start.offset > offset) {
        break;
      }

      line = start.line;
    }

    return line;
  }
}
