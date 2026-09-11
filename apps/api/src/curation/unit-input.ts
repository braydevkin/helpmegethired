import { CURATION_UNIT_INPUT_MAX_CHARACTERS, type CurationUnitKind, type Id } from "@helpmegethired/shared";

import type { CurationSource } from "./model/curation-prompt";

export interface CuratedExperience {
  id: Id;
  role: string;
  company: string | null;
  description: string | null;
}

export interface CuratedProject {
  id: Id;
  name: string;
  description: string | null;
}

export interface UnitSubjects {
  experiences: readonly CuratedExperience[];
  projects: readonly CuratedProject[];
}

export interface UnitInput {
  sources: CurationSource[];
  truncated: boolean;
}

const experienceSource = ({ id, role, company, description }: CuratedExperience): CurationSource => ({
  kind: "experience",
  referenceId: id,
  title: company ? `${role} at ${company}` : role,
  text: description ?? "",
});

const projectSource = ({ id, name, description }: CuratedProject): CurationSource => ({ kind: "project", referenceId: id, title: name, text: description ?? "" });

// An Experience or Project unit reads its own subject; the cross-cutting and synthesis units read
// all of them, since the competences they look for and the career they sum up span every one.
export function sourcesOf(unit: { kind: CurationUnitKind; subjectId: Id | null }, subjects: UnitSubjects): CurationSource[] {
  switch (unit.kind) {
    case "experience":
      return subjects.experiences.filter((experience) => experience.id === unit.subjectId).map(experienceSource);
    case "project":
      return subjects.projects.filter((project) => project.id === unit.subjectId).map(projectSource);
    default:
      return [...subjects.experiences.map(experienceSource), ...subjects.projects.map(projectSource)];
  }
}

// The cap counts every character of the Candidate's own text a prompt carries, titles included,
// and cuts a source at its last line boundary before the cap, so no source ends mid-line.
export function cappedInput(sources: readonly CurationSource[], cap: number = CURATION_UNIT_INPUT_MAX_CHARACTERS): UnitInput {
  const kept: CurationSource[] = [];
  let remaining = cap;

  for (const source of sources) {
    remaining -= source.title.length;

    if (remaining < 0) {
      return { sources: kept, truncated: true };
    }

    if (source.text.length <= remaining) {
      kept.push(source);
      remaining -= source.text.length;
      continue;
    }

    const cut = source.text.slice(0, remaining);

    kept.push({ ...source, text: cut.slice(0, Math.max(cut.lastIndexOf("\n"), 0)) });

    return { sources: kept, truncated: true };
  }

  return { sources: kept, truncated: false };
}
