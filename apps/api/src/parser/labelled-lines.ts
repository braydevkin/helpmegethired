import { sectionKindOf, type SectionKind } from "./dictionaries/section-headers";
import type { Section } from "./sections";
import { isBlank, normalise } from "./text";

export interface LabelledParagraph {
  kind: SectionKind;
  text: string;
}

export interface PartitionedLines {
  own: string[];
  labelled: LabelledParagraph[];
}

// "Idiomas: Português (nativo), Inglês (fluente)" carries a whole part on one line, wherever
// it sits: the label before the colon is a section heading of some kind.
export function labelKindOf(line: string): SectionKind | undefined {
  const colon = line.indexOf(":");

  return colon === -1 ? undefined : sectionKindOf(normalise(line.slice(0, colon)));
}

const afterLabel = (line: string): string => line.slice(line.indexOf(":") + 1).trim();

interface ParagraphEnd {
  text: string;
  next: number;
}

const continuesParagraph = (line: string | undefined): boolean => line !== undefined && !isBlank(line) && labelKindOf(line) === undefined;

// A labelled line and the lines wrapped under it, up to the next blank line or the next
// labelled line, are one paragraph.
function paragraphFrom(lines: readonly string[], start: number): ParagraphEnd {
  const paragraph = [afterLabel(lines[start] ?? "")];
  let next = start + 1;

  while (continuesParagraph(lines[next])) {
    paragraph.push((lines[next] ?? "").trim());
    next += 1;
  }

  return { text: paragraph.join(" "), next };
}

// Paragraphs labelled with another kind are taken out of the section; the other lines stay,
// with a label of the section's own kind stripped.
export function partitionLabelled(lines: readonly string[], ownKind: SectionKind): PartitionedLines {
  const own: string[] = [];
  const labelled: LabelledParagraph[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const kind = labelKindOf(line);

    if (kind !== undefined && kind !== ownKind) {
      const { text, next } = paragraphFrom(lines, index);

      labelled.push({ kind, text });
      index = next;
    } else {
      own.push(kind === ownKind ? afterLabel(line) : line);
      index += 1;
    }
  }

  return { own, labelled };
}

export const ownLinesOf = (sections: readonly Section[], kind: SectionKind): string[] =>
  sections.filter((section) => section.kind === kind).flatMap((section) => partitionLabelled(section.lines, kind).own);

// The sections' own lines of that kind plus every paragraph labelled with it found elsewhere.
export const linesOfKind = (sections: readonly Section[], kind: SectionKind): string[] =>
  sections.flatMap((section) =>
    section.kind === kind
      ? partitionLabelled(section.lines, kind).own
      : partitionLabelled(section.lines, section.kind)
          .labelled.filter((paragraph) => paragraph.kind === kind)
          .map((paragraph) => paragraph.text),
  );
