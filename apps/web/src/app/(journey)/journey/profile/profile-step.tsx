import type { Certification, Profile } from "@helpmegethired/shared";

import { ProfileActions } from "../../../../components/molecules/profile-actions/profile-actions";
import { ProfileHeading } from "../../../../components/molecules/profile-heading/profile-heading";
import { ReviewNotice } from "../../../../components/molecules/review-notice/review-notice";
import { EducationList, type EducationEntry } from "../../../../components/organisms/education-list/education-list";
import { ExperienceTimeline, type ExperienceEntry } from "../../../../components/organisms/experience-timeline/experience-timeline";
import { ProfileSidebar } from "../../../../components/organisms/profile-sidebar/profile-sidebar";
import { ProfileStats } from "../../../../components/organisms/profile-stats/profile-stats";
import { ProjectsGrid, type ProjectEntry } from "../../../../components/organisms/projects-grid/projects-grid";
import { SkillsGroups } from "../../../../components/organisms/skills-groups/skills-groups";
import { completenessOf } from "../../../../lib/profile/completeness";
import { contactRowsOf } from "../../../../lib/profile/contact";
import { careerSpanOf, periodLabelOf } from "../../../../lib/profile/period";
import { reviewNoteOf, reviewNoticeOf } from "../../../../lib/profile/review";
import { skillGroupsOf } from "../../../../lib/profile/skills";
import { RESUME_STEP_PATH } from "../../../paths";
import type { Candidate } from "../candidate";
import { JourneyFrame } from "../journey-frame";
import { confirmProfileAction } from "./actions";

export interface ProfileStepProps {
  candidate: Candidate;
  profile: Profile;
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

const certificationsOf = (certifications: readonly Certification[]) =>
  certifications.map(({ name, issuer, year }) => ({ name, meta: joined([issuer, year]) }));

const statsOf = (profile: Profile) => [
  { value: profile.yearsOfExperience, label: "Years of experience" },
  { value: profile.experiences.length, label: "Roles" },
  { value: profile.skills.length, label: "Skills" },
  { value: profile.projects.length, label: "Projects" },
];

const skillsGroupsOf = (profile: Profile) => skillGroupsOf(profile.skills).map(({ name, skills }) => ({ name, skills: skills.map((skill) => skill.name) }));

// The Profile as the Candidate reviews it: the Account's own information beside what the
// Ingestion recognized, with everything it was unsure about called out.
export function ProfileStep({ candidate, profile }: ProfileStepProps) {
  const notice = reviewNoticeOf(profile.reviewFlags);
  const experiences = experienceEntriesOf(profile);
  const education = educationEntriesOf(profile);
  const projects = projectEntriesOf(profile);
  const skillGroups = skillsGroupsOf(profile);
  const experienceMeta = joined([counted(experiences.length, "role", "roles"), careerSpanOf(profile.experiences)]);

  return (
    <JourneyFrame
      candidate={candidate}
      stepLabel={`Extracted from ${profile.source?.fileName ?? UNNAMED_SOURCE}`}
      heading={
        <ProfileHeading
          eyebrow="Your profile"
          name={candidate.name}
          headline={headlineOf(profile)}
          actions={<ProfileActions uploadHref={RESUME_STEP_PATH} confirmed={profile.confirmedAt !== null} confirm={confirmProfileAction} />}
        />
      }
      sidebar={
        <ProfileSidebar
          completeness={completenessOf(profile)}
          contact={contactRowsOf(candidate.account, profile.basicProfile)}
          languages={profile.languages}
          certifications={certificationsOf(profile.certifications)}
        />
      }
    >
      <ProfileStats stats={statsOf(profile)} />
      {notice && <ReviewNotice {...notice} />}
      {experiences.length > 0 && <ExperienceTimeline entries={experiences} meta={experienceMeta} />}
      {education.length > 0 && <EducationList entries={education} />}
      {projects.length > 0 && <ProjectsGrid entries={projects} />}
      {skillGroups.length > 0 && <SkillsGroups groups={skillGroups} meta={`${profile.skills.length} extracted`} />}
    </JourneyFrame>
  );
}
