import type { Certification, Profile } from "@helpmegethired/shared";

import type { StatTileProps } from "../../../../components/atoms/stat-tile/stat-tile";
import type { CertificationEntryProps } from "../../../../components/molecules/certification-entry/certification-entry";
import type { SkillGroupProps } from "../../../../components/molecules/skill-group/skill-group";
import type { EducationEntry } from "../../../../components/organisms/education-list/education-list";
import type { ExperienceEntry } from "../../../../components/organisms/experience-timeline/experience-timeline";
import type { ProjectEntry } from "../../../../components/organisms/projects-grid/projects-grid";
import { completenessOf, type Completeness } from "../../../../lib/profile/completeness";
import { careerSpanOf, periodLabelOf } from "../../../../lib/profile/period";
import { reviewNoteOf, reviewNoticeOf, type ReviewNotice } from "../../../../lib/profile/review";
import { skillGroupsOf } from "../../../../lib/profile/skills";

// Everything the Profile step renders, read from the Profile alone; the Candidate's own
// name and contact come from the Account beside it.
export interface ProfileView {
  sourceLabel: string;
  headline: string;
  completeness: Completeness;
  certifications: CertificationEntryProps[];
  stats: StatTileProps[];
  notice: ReviewNotice | null;
  experiences: ExperienceEntry[];
  experienceMeta: string | null;
  education: EducationEntry[];
  projects: ProjectEntry[];
  skillGroups: SkillGroupProps[];
  skillsMeta: string;
}

const UNNAMED_SOURCE = "your résumé";

const counted = (count: number, singular: string, plural: string): string => `${count} ${count === 1 ? singular : plural}`;

const joined = (parts: readonly (string | number | null)[]): string | null => parts.filter((part) => part !== null).join(" · ") || null;

// The line under the name: what the Candidate does, and for how long.
const headlineOf = ({ basicProfile, yearsOfExperience }: Profile): string =>
  [basicProfile.headline, `${counted(yearsOfExperience, "year", "years")} of experience`].filter((part) => part !== null).join(" · ");

const experienceEntriesOf = ({ experiences, reviewFlags }: Profile): ExperienceEntry[] =>
  experiences.map((experience) => ({
    id: experience.id,
    role: experience.role,
    company: experience.company,
    period: experience.period && periodLabelOf(experience.period),
    description: experience.description,
    note: reviewNoteOf(reviewFlags, "experience", experience.role),
    skills: experience.skills,
  }));

// The degree names the entry, as the design proposes; one without a degree falls back to
// the institution and then does not repeat it below.
const educationEntriesOf = ({ education, reviewFlags }: Profile): EducationEntry[] =>
  education.map((entry) => {
    const title = joined([entry.degree, entry.fieldOfStudy]);

    return {
      id: entry.id,
      title: title ?? entry.institution,
      institution: title === null ? null : entry.institution,
      period: entry.period && periodLabelOf(entry.period),
      note: reviewNoteOf(reviewFlags, "education", entry.institution),
    };
  });

const projectEntriesOf = ({ projects }: Profile): ProjectEntry[] =>
  projects.map((project) => ({ id: project.id, name: project.name, description: project.description, stack: joined(project.skills) }));

const certificationsOf = (certifications: readonly Certification[]): CertificationEntryProps[] =>
  certifications.map(({ name, issuer, year }) => ({ name, meta: joined([issuer, year]) }));

const statsOf = (profile: Profile): StatTileProps[] => [
  { value: profile.yearsOfExperience, label: "Years of experience" },
  { value: profile.experiences.length, label: "Roles" },
  { value: profile.skills.length, label: "Skills" },
  { value: profile.projects.length, label: "Projects" },
];

const skillGroupPropsOf = ({ skills }: Profile): SkillGroupProps[] =>
  skillGroupsOf(skills).map((group) => ({ name: group.name, skills: group.skills.map((skill) => skill.name) }));

export const profileViewOf = (profile: Profile): ProfileView => ({
  sourceLabel: `Extracted from ${profile.source?.fileName ?? UNNAMED_SOURCE}`,
  headline: headlineOf(profile),
  completeness: completenessOf(profile),
  certifications: certificationsOf(profile.certifications),
  stats: statsOf(profile),
  notice: reviewNoticeOf(profile.reviewFlags),
  experiences: experienceEntriesOf(profile),
  experienceMeta: joined([counted(profile.experiences.length, "role", "roles"), careerSpanOf(profile.experiences)]),
  education: educationEntriesOf(profile),
  projects: projectEntriesOf(profile),
  skillGroups: skillGroupPropsOf(profile),
  skillsMeta: `${profile.skills.length} extracted`,
});
