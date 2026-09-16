const DIACRITICS = /\p{Diacritic}/gu;
const SEPARATOR = /[\s/]/u;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const URL_SCHEME = /^https?:\/\//iu;

interface Span {
  start: number;
  end: number;
}

// The folded form compares text the way a reader does: without case or accents, with any run of
// whitespace or slashes as one space. Each folded code unit remembers the original characters it
// came from, so a match in the folded form is cut from the original text verbatim.
interface FoldedText {
  text: string;
  starts: number[];
  ends: number[];
}

function fold(text: string, matchCase: boolean): FoldedText {
  const folded: FoldedText = { text: "", starts: [], ends: [] };
  let index = 0;

  for (const character of text) {
    const end = index + character.length;
    const form = SEPARATOR.test(character) ? " " : matchCase ? character : character.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

    if (form !== " " || (folded.text.length > 0 && !folded.text.endsWith(" "))) {
      for (let unit = 0; unit < form.length; unit += 1) {
        folded.starts.push(index);
        folded.ends.push(end);
      }

      folded.text += form;
    }

    index = end;
  }

  return folded;
}

const isWordCharacter = (character: string | undefined): boolean => character !== undefined && WORD_CHARACTER.test(character);

// A match that starts or ends on a word character must not continue a word of the text there.
function isWholeWordsAt(text: string, wanted: string, found: number): boolean {
  const opensWord = !isWordCharacter(wanted[0]) || !isWordCharacter(text[found - 1]);
  const closesWord = !isWordCharacter(wanted.at(-1)) || !isWordCharacter(text[found + wanted.length]);

  return opensWord && closesWord;
}

export interface SpanOptions {
  matchCase?: boolean;
  from?: number;
}

// A Segment's text, searched for the verbatim span a value was read from. A word is matched
// whole, so `Java` is never found inside `JavaScript`.
export class VerbatimText {
  private readonly folded = new Map<boolean, FoldedText>();

  constructor(readonly text: string) {}

  spanOf(needle: string, { matchCase = false, from = 0 }: SpanOptions = {}): Span | undefined {
    const haystack = this.foldedText(matchCase);
    const wanted = fold(needle, matchCase).text.trimEnd();
    const firstIndex = haystack.starts.findIndex((start) => start >= from);

    if (wanted.length === 0 || firstIndex === -1) {
      return undefined;
    }

    for (let found = haystack.text.indexOf(wanted, firstIndex); found !== -1; found = haystack.text.indexOf(wanted, found + 1)) {
      const last = found + wanted.length - 1;

      if (isWholeWordsAt(haystack.text, wanted, found)) {
        return { start: haystack.starts[found] ?? 0, end: haystack.ends[last] ?? 0 };
      }
    }

    return undefined;
  }

  // A value the rules tidied, as a description with its link taken out, is quoted from where its
  // longest opening words are found to where its longest closing words are found after them.
  quoteOf(value: string): string | undefined {
    const whole = this.spanOf(value);

    if (whole) {
      return this.sliceOf(whole);
    }

    const words = fold(value, false).text.trim().split(" ");

    for (let opening = words.length - 1; opening >= 1; opening -= 1) {
      const start = this.spanOf(words.slice(0, opening).join(" "));

      if (start) {
        const quote = this.closingQuoteOf(words.slice(opening), start);

        return quote !== undefined && holdsInOrder(quote, words) ? quote : undefined;
      }
    }

    return undefined;
  }

  // The rules answer a link with its scheme, as `https://github.com/ada`, however it is written.
  urlQuoteOf(url: string): string | undefined {
    return this.quoteOf(url) ?? this.quoteOf(url.replace(URL_SCHEME, ""));
  }

  sliceOf({ start, end }: Span): string {
    return this.text.slice(start, end);
  }

  private closingQuoteOf(rest: readonly string[], start: Span): string | undefined {
    for (let closing = 0; closing < rest.length; closing += 1) {
      const end = this.spanOf(rest.slice(closing).join(" "), { from: start.end });

      if (end) {
        return this.sliceOf({ start: start.start, end: end.end });
      }
    }

    return undefined;
  }

  private foldedText(matchCase: boolean): FoldedText {
    const cached = this.folded.get(matchCase) ?? fold(this.text, matchCase);

    this.folded.set(matchCase, cached);

    return cached;
  }
}

// A span may carry what the rules left out of the value, never lose or change one of its words.
function holdsInOrder(quote: string, words: readonly string[]): boolean {
  const text = new VerbatimText(quote);
  let from = 0;

  for (const word of words) {
    const span = text.spanOf(word, { from });

    if (!span) {
      return false;
    }

    from = span.end;
  }

  return true;
}
