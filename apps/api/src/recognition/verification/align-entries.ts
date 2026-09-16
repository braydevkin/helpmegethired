import { wordsOf, type SegmentText } from "./segment-text";

// One entry of a list part as either reading sees it: the text that names it and the lines of
// the Segment its values sit on.
export interface LocatedEntry<Entry> {
  entry: Entry;
  identity: string;
  lines: readonly number[];
}

// An entry before it is located: the values that name it and the texts it is written with.
export interface EntryToLocate<Entry> {
  entry: Entry;
  names: readonly (string | undefined)[];
  texts: readonly (string | undefined)[];
}

export interface AlignedEntry<ByModel, ByRules> {
  byModel: ByModel;
  byRules: ByRules | null;
}

type LineSpan = readonly number[];

const uniqueLines = (lines: readonly number[]): number[] => [...new Set(lines)].sort((left, right) => left - right);

const distanceBetween = (one: LineSpan, other: LineSpan): number => Math.abs((one[0] ?? 0) - (other[0] ?? 0));

const nearestTo = (anchor: LineSpan, spans: readonly LineSpan[]): LineSpan =>
  spans.reduce((nearest, span) => (distanceBetween(span, anchor) < distanceBetween(nearest, anchor) ? span : nearest));

// The Segment is the whole resume, so a role or a company may be written at more than one entry.
// An entry sits where its rarest text is written, the first time after the entry before it when
// that text repeats too, and on the occurrences of its other texts nearest to that place.
function linesOfEntry(text: SegmentText, texts: readonly (string | undefined)[], previousStart: number): number[] {
  const occurrences = texts.flatMap((value) => (value === undefined ? [] : [text.occurrencesOf(value)])).filter((spans) => spans.length > 0);
  const rarest = occurrences.reduce<LineSpan[] | undefined>((fewest, spans) => (fewest === undefined || spans.length < fewest.length ? spans : fewest), undefined);

  if (rarest === undefined) {
    return [];
  }

  const anchor = rarest.find((span) => (span[0] ?? 0) > previousStart) ?? rarest[0] ?? [];

  return uniqueLines(occurrences.flatMap((spans) => (spans === rarest ? anchor : nearestTo(anchor, spans))));
}

export function locatedEntries<Entry>(text: SegmentText, entries: readonly EntryToLocate<Entry>[]): LocatedEntry<Entry>[] {
  let previousStart = -1;

  return entries.map(({ entry, names, texts }) => {
    const lines = linesOfEntry(text, texts, previousStart);

    previousStart = lines[0] ?? previousStart;

    return { entry, identity: names.filter((name) => name !== undefined).join(" "), lines };
  });
}

type Score = (byModel: LocatedEntry<unknown>, byRules: LocatedEntry<unknown>) => number;

export const MATCH_THRESHOLD = 0.5;

// The share of words two names have in common (the Dice coefficient), blind to their order, so a
// heading the rules split the wrong way round still names the same Experience.
export function identitySimilarity(byModel: LocatedEntry<unknown>, byRules: LocatedEntry<unknown>): number {
  const left = new Set(wordsOf(byModel.identity));
  const right = new Set(wordsOf(byRules.identity));
  const shared = [...left].filter((word) => right.has(word)).length;

  return left.size + right.size === 0 ? 0 : (2 * shared) / (left.size + right.size);
}

const lineOverlap = (byModel: LocatedEntry<unknown>, byRules: LocatedEntry<unknown>): number => {
  const left = new Set(byModel.lines);
  const right = new Set(byRules.lines);
  const shared = [...left].filter((line) => right.has(line)).length;
  const union = new Set([...left, ...right]).size;

  return union === 0 ? 0 : shared / union;
};

// An entry that spans lines is the same entry when it names the same thing or covers the same
// lines, which still pairs them when the rules took a bullet for the heading. Entries that share
// one line, as languages listed on a single row do, pair by name alone.
export const spanningEntryScore: Score = (byModel, byRules) => Math.max(identitySimilarity(byModel, byRules), lineOverlap(byModel, byRules));

export const oneLineEntryScore: Score = identitySimilarity;

const firstLineOf = (entry: LocatedEntry<unknown>): number => Math.min(...entry.lines);

// Pairs are taken best first, one Model entry for one rules entry: the answer maps a rules
// entry's index to its Model entry's index. Two positions under the same role score the same by
// name, so a tie goes to the entries that sit on the same lines.
function pairsOf(byModel: readonly LocatedEntry<unknown>[], byRules: readonly LocatedEntry<unknown>[], score: Score): Map<number, number> {
  const candidates = byModel
    .flatMap((model, modelIndex) =>
      byRules.map((rules, rulesIndex) => ({ modelIndex, rulesIndex, score: score(model, rules), overlap: lineOverlap(model, rules) })),
    )
    .filter((candidate) => candidate.score >= MATCH_THRESHOLD)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.overlap - left.overlap ||
        Math.abs(left.modelIndex - left.rulesIndex) - Math.abs(right.modelIndex - right.rulesIndex),
    );
  const modelOf = new Map<number, number>();
  const pairedModels = new Set<number>();

  for (const candidate of candidates) {
    if (!modelOf.has(candidate.rulesIndex) && !pairedModels.has(candidate.modelIndex)) {
      modelOf.set(candidate.rulesIndex, candidate.modelIndex);
      pairedModels.add(candidate.modelIndex);
    }
  }

  return modelOf;
}

interface Placement<ByModel, ByRules> {
  anchor: number;
  aligned: AlignedEntry<ByModel, ByRules>;
}

// The Model decides which entries exist, since the rules cut entries where a resume's layout
// misleads them: a rules entry the Model did not read is left out, and one it did read only
// verifies the fields of its Model entry. The rules' order is kept for the paired entries, and an
// entry only the Model read goes before the first entry that sits below it in the Segment.
export function alignEntries<ByModel, ByRules>(
  byModel: readonly LocatedEntry<ByModel>[],
  byRules: readonly LocatedEntry<ByRules>[],
  score: Score,
): AlignedEntry<ByModel, ByRules>[] {
  const modelOf = pairsOf(byModel, byRules, score);
  const pairedModels = new Set(modelOf.values());
  const placements: Placement<ByModel, ByRules>[] = byRules.flatMap((rules, rulesIndex) => {
    const model = byModel[modelOf.get(rulesIndex) ?? -1];

    return model ? [{ anchor: Math.min(firstLineOf(rules), firstLineOf(model)), aligned: { byModel: model.entry, byRules: rules.entry } }] : [];
  });

  byModel.forEach((model, modelIndex) => {
    if (pairedModels.has(modelIndex)) {
      return;
    }

    const anchor = firstLineOf(model);
    const below = placements.findIndex((placement) => Number.isFinite(placement.anchor) && placement.anchor > anchor);

    placements.splice(below === -1 ? placements.length : below, 0, { anchor, aligned: { byModel: model.entry, byRules: null } });
  });

  return placements.map((placement) => placement.aligned);
}
