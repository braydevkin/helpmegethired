const LINE_ENDINGS = /\r\n?/g;
const FORM_FEED = /\f/g;
const HYPHENATED_BREAK = /(\S*\p{Ll})-\n(\p{Ll}\S*)/gu;
const ADDRESS_MARKS = /[/@]/u;
const BULLET = /^\s*[•●▪◦‣⁃∙·■□○►➢➤✓✔→*\-–—»]+(\s+|$)/u;
const SPACES = /[ \t]{2,}/g;
const PAGE_NUMBER = /^\s*(\d{1,3}|page\s+\d+(\s+of\s+\d+)?|p[áa]g(ina)?\.?\s+\d+(\s+de\s+\d+)?|\d+\s*\/\s*\d+)\s*$/iu;

const isPageNumber = (line: string): boolean => PAGE_NUMBER.test(line);

// A word broken at a line end loses its hyphen; a URL or an e-mail broken there keeps it,
// because the hyphen is part of the address.
const joinHyphenatedBreak = (_match: string, before: string, after: string): string =>
  ADDRESS_MARKS.test(`${before}${after}`) ? `${before}-${after}` : `${before}${after}`;

function collapseBlankRuns(lines: readonly string[]): string[] {
  const kept: string[] = [];

  for (const line of lines) {
    if (line.length === 0 && kept.at(-1) === "") {
      continue;
    }

    kept.push(line);
  }

  while (kept[0] === "") {
    kept.shift();
  }

  while (kept.at(-1) === "") {
    kept.pop();
  }

  return kept;
}

// The text as pdftotext keeps it, made regular: one line ending, a page break as a blank line,
// words split by a hyphen at a line end rejoined, bullets and page numbers gone, one space
// between words, at most one blank line in a row.
export function cleanText(raw: string): string {
  const joined = raw.replace(LINE_ENDINGS, "\n").replace(FORM_FEED, "\n").replace(HYPHENATED_BREAK, joinHyphenatedBreak);
  const lines = joined
    .split("\n")
    .map((line) => line.replace(BULLET, "").replace(SPACES, " ").trim())
    .filter((line) => !isPageNumber(line));

  return collapseBlankRuns(lines).join("\n");
}
