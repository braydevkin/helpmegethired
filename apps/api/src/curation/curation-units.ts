import type { CurationUnitKind, Id } from "@helpmegethired/shared";

export interface CurationSubjects {
  experiences: readonly { id: Id; role: string; company: string | null }[];
  projects: readonly { id: Id; name: string }[];
}

export interface NewCurationUnit {
  kind: CurationUnitKind;
  position: number;
  subjectId: Id | null;
  title: string;
}

export const CROSS_CUTTING_TITLE = "Competences that appear in more than one place";
export const SYNTHESIS_TITLE = "The whole career, read together";

// Every Experience and Project gets a unit however many there are, and the synthesis unit comes
// last because it reads what the others produced (ADR-0024). Deriving them all at creation gives
// progress its denominator from the first second.
export function unitsOf({ experiences, projects }: CurationSubjects): NewCurationUnit[] {
  const units: Omit<NewCurationUnit, "position">[] = [
    ...experiences.map(({ id, role, company }) => ({ kind: "experience" as const, subjectId: id, title: company ? `${role} at ${company}` : role })),
    ...projects.map(({ id, name }) => ({ kind: "project" as const, subjectId: id, title: name })),
    { kind: "cross_cutting", subjectId: null, title: CROSS_CUTTING_TITLE },
    { kind: "synthesis", subjectId: null, title: SYNTHESIS_TITLE },
  ];

  return units.map((unit, position) => ({ ...unit, position }));
}
