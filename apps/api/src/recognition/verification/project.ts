import type { DraftProject, SegmentRecognition } from "@helpmegethired/shared";

import { skillNamesIn } from "../../parser";
import type { RecognizedProject } from "../../profile/segments/recognized";
import { alignEntries, type AlignedEntry, locatedEntries, spanningEntryScore } from "./align-entries";
import { textReadingOf, textRule, urlReadingOf, urlRule, verifiedField, type Reading } from "./fields";
import { SegmentText } from "./segment-text";
import { distinctNames, skillNamesOf } from "./skill-names";

type ProjectByModel = SegmentRecognition<"project">["projects"][number];

interface ProjectReading {
  name: Reading<string>;
  description: Reading<string> | null;
  url: Reading<string> | null;
  skills: string[];
}

const plainText = textRule();

function readingOf(text: SegmentText, project: ProjectByModel): ProjectReading | null {
  const name = textReadingOf(text, project.name);

  return name
    ? {
        name,
        description: textReadingOf(text, project.description),
        url: urlReadingOf(text, project.url),
        skills: skillNamesOf(text, project.skills),
      }
    : null;
}

function merged({ byModel, byRules }: AlignedEntry<ProjectReading, DraftProject>): DraftProject {
  const name = verifiedField(byRules?.name ?? null, byModel.name, plainText);
  const description = verifiedField(byRules?.description ?? null, byModel.description, plainText);

  return {
    name,
    description,
    url: verifiedField(byRules?.url ?? null, byModel.url, urlRule),
    skills: distinctNames([...(byRules?.skills ?? []), ...byModel.skills, ...skillNamesIn(`${name.value}\n${description?.value ?? ""}`)]),
  };
}

export function verifyProject(lines: readonly string[], byRules: RecognizedProject, byModel: SegmentRecognition<"project">): RecognizedProject {
  const text = new SegmentText(lines);
  const readings = byModel.projects.flatMap((project) => readingOf(text, project) ?? []);
  const aligned = alignEntries(
    locatedEntries(
      text,
      readings.map((reading) => ({
        entry: reading,
        names: [reading.name.value],
        texts: [reading.name.quote, reading.description?.quote, reading.url?.quote],
      })),
    ),
    locatedEntries(
      text,
      byRules.projects.map((project) => ({ entry: project, names: [project.name.value], texts: [project.name.value, project.description?.value] })),
    ),
    spanningEntryScore,
  );

  return { projects: aligned.map(merged) };
}
