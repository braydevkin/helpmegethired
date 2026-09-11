import { CurationProgressSchema, type CurationProgress, type CurationUnitKind, type CurationUnitSummary } from "@helpmegethired/shared";

const idOf = (index: number): string => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

export const unitOf = (index: number, overrides: Partial<CurationUnitSummary> = {}): CurationUnitSummary => ({
  id: idOf(index + 1),
  kind: "experience" satisfies CurationUnitKind,
  title: `Role ${index + 1} at Company ${index + 1}`,
  status: "pending",
  failureReason: null,
  ...overrides,
});

// `saved` units, then `running`, then the rest waiting: the shape a run has partway through.
export const unitsOf = (total: number, saved: number, running = 1): CurationUnitSummary[] =>
  Array.from({ length: total }, (_, index) => unitOf(index, { status: index < saved ? "saved" : index < saved + running ? "running" : "pending" }));

// Parsed through the shared schema, so every payload a test renders is one the API may send.
export function progressOf(list: readonly CurationUnitSummary[], overrides: Partial<Omit<CurationProgress, "units">> = {}): CurationProgress {
  const saved = list.filter((unit) => unit.status === "saved").length;

  return CurationProgressSchema.parse({
    curationId: idOf(0),
    status: "running",
    percentage: list.length === 0 ? 0 : Math.floor((100 * saved) / list.length),
    units: { total: list.length, saved, list },
    metrics: {
      careerDuration: { years: 7, months: 2 },
      durationPerCompany: [{ company: "Northwind Labs", duration: { years: 4, months: 0 } }],
      counts: { roles: 4, projects: 3, certifications: 2, languages: 3, education: 1 },
    },
    modelId: "claude-sonnet-5",
    failureReason: null,
    resumeAfter: null,
    ...overrides,
  });
}
