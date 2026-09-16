import { wordsOf, type SegmentText } from "./segment-text";

// One entry of a list part as either reading sees it: the text that names it and the lines of
// the Segment its values sit on.
export interface LocatedEntry<Entry> {
  entry: Entry;
  identity: string;
  lines: readonly number[];
}

export type AlignedEntry<ByModel, ByRules> = { byModel: ByModel; byRules: ByRules | null } | { byModel: null; byRules: ByRules };

interface Placed {
  lines: readonly number[];
}

const uniqueLines = (lines: readonly number[]): number[] => [...new Set(lines)].sort((left, right) => left - right);

// A Model entry sits on the lines its quotes span.
export const locatedByModel = <Entry>(entry: Entry, names: readonly (string | undefined)[], readings: readonly (Placed | null)[]): LocatedEntry<Entry> => ({
  entry,
  identity: names.filter((name) => name !== undefined).join(" "),
  lines: uniqueLines(readings.flatMap((reading) => reading?.lines ?? [])),
});

// A rules entry sits on the lines where its text values are found.
export const locatedByRules = <Entry>(text: SegmentText, entry: Entry, names: readonly (string | undefined)[], values: readonly (string | undefined)[]): LocatedEntry<Entry> => ({
  entry,
  identity: names.filter((name) => name !== undefined).join(" "),
  lines: uniqueLines(values.flatMap((value) => (value === undefined ? [] : (text.linesOf(value) ?? [])))),
});

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
// entry's index to its Model entry's index.
function pairsOf(byModel: readonly LocatedEntry<unknown>[], byRules: readonly LocatedEntry<unknown>[], score: Score): Map<number, number> {
  const candidates = byModel
    .flatMap((model, modelIndex) => byRules.map((rules, rulesIndex) => ({ modelIndex, rulesIndex, score: score(model, rules) })))
    .filter((candidate) => candidate.score >= MATCH_THRESHOLD)
    .sort((left, right) => right.score - left.score || Math.abs(left.modelIndex - left.rulesIndex) - Math.abs(right.modelIndex - right.rulesIndex));
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

// The rules' order is kept, and an entry only the Model read goes before the first entry that
// sits below it in the Segment.
export function alignEntries<ByModel, ByRules>(
  byModel: readonly LocatedEntry<ByModel>[],
  byRules: readonly LocatedEntry<ByRules>[],
  score: Score,
): AlignedEntry<ByModel, ByRules>[] {
  const modelOf = pairsOf(byModel, byRules, score);
  const pairedModels = new Set(modelOf.values());
  const placements: Placement<ByModel, ByRules>[] = byRules.map((rules, rulesIndex) => {
    const model = byModel[modelOf.get(rulesIndex) ?? -1];

    return model
      ? { anchor: Math.min(firstLineOf(rules), firstLineOf(model)), aligned: { byModel: model.entry, byRules: rules.entry } }
      : { anchor: firstLineOf(rules), aligned: { byModel: null, byRules: rules.entry } };
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
