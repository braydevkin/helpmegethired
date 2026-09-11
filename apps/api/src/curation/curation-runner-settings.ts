export interface CurationRunnerSettings {
  unitConcurrency: number;
}

export const CURATION_RUNNER_SETTINGS = Symbol("CURATION_RUNNER_SETTINGS");

// Three calls at once keeps a Curation short without stacking a Candidate's own rate limit; the
// integration suite pins one so the order of the calls is the order of the units.
export const DEFAULT_CURATION_RUNNER_SETTINGS: CurationRunnerSettings = { unitConcurrency: 3 };
