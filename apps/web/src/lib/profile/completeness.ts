import type { Profile } from "@helpmegethired/shared";

export interface Completeness {
  percentage: number;
  hint: string;
}

const MINIMUM_SKILLS = 3;
const NAMED_IN_HINT = 2;
const COMPLETE_HINT = "Nothing is missing — your Profile has everything the analysis looks for.";

// One point each, named the way the hint asks for it: what the analysis needs to work with.
const POINTS: readonly { label: string; earned: (profile: Profile) => boolean }[] = [
  { label: "a headline", earned: ({ basicProfile }) => basicProfile.headline !== null },
  { label: "a summary line", earned: ({ basicProfile }) => basicProfile.summary !== null },
  { label: "your LinkedIn URL", earned: ({ basicProfile }) => basicProfile.linkedinUrl !== null },
  { label: "your GitHub URL", earned: ({ basicProfile }) => basicProfile.githubUrl !== null },
  { label: "a role", earned: ({ experiences }) => experiences.length > 0 },
  { label: "your education", earned: ({ education }) => education.length > 0 },
  { label: "three skills", earned: ({ skills }) => skills.length >= MINIMUM_SKILLS },
  { label: "a language", earned: ({ languages }) => languages.length > 0 },
];

const PERCENT = 100;

// The hint names the two first missing points, so it stays one readable line.
const hintOf = (missing: readonly string[]): string =>
  missing.length === 0 ? COMPLETE_HINT : `Add ${missing.slice(0, NAMED_IN_HINT).join(" and ")} to reach 100% and unlock better role matching.`;

export function completenessOf(profile: Profile): Completeness {
  const missing = POINTS.filter((point) => !point.earned(profile)).map((point) => point.label);

  return { percentage: Math.round(((POINTS.length - missing.length) * PERCENT) / POINTS.length), hint: hintOf(missing) };
}
