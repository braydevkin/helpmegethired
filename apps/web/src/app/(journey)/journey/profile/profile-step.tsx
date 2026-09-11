import type { Profile } from "@helpmegethired/shared";

import { ProfileActions } from "../../../../components/molecules/profile-actions/profile-actions";
import { ProfileHeading } from "../../../../components/molecules/profile-heading/profile-heading";
import { ReviewNotice } from "../../../../components/molecules/review-notice/review-notice";
import { EducationList } from "../../../../components/organisms/education-list/education-list";
import { ExperienceTimeline } from "../../../../components/organisms/experience-timeline/experience-timeline";
import { ProfileSidebar } from "../../../../components/organisms/profile-sidebar/profile-sidebar";
import { ProfileStats } from "../../../../components/organisms/profile-stats/profile-stats";
import { ProjectsGrid } from "../../../../components/organisms/projects-grid/projects-grid";
import { SkillsGroups } from "../../../../components/organisms/skills-groups/skills-groups";
import { contactRowsOf } from "../../../../lib/profile/contact";
import { ANALYSIS_PATH, RESUME_STEP_PATH } from "../../../paths";
import type { Candidate } from "../candidate";
import { JourneyFrame } from "../journey-frame";
import { confirmProfileAction } from "./actions";
import { profileViewOf } from "./profile-view";

export interface ProfileStepProps {
  candidate: Candidate;
  profile: Profile;
}

// The Profile as the Candidate reviews it: the Account's own information beside what the
// Ingestion recognized, with everything it was unsure about called out.
export function ProfileStep({ candidate, profile }: ProfileStepProps) {
  const view = profileViewOf(profile);

  return (
    <JourneyFrame
      candidate={candidate}
      stepLabel={view.sourceLabel}
      heading={
        <ProfileHeading
          eyebrow="Your profile"
          name={candidate.name}
          headline={view.headline}
          actions={<ProfileActions uploadHref={RESUME_STEP_PATH} analysisHref={ANALYSIS_PATH} confirmed={profile.confirmedAt !== null} confirm={confirmProfileAction} />}
        />
      }
      sidebar={
        <ProfileSidebar
          completeness={view.completeness}
          contact={contactRowsOf(candidate.account, profile.basicProfile)}
          languages={profile.languages}
          certifications={view.certifications}
        />
      }
    >
      <ProfileStats stats={view.stats} />
      {view.notice && <ReviewNotice {...view.notice} />}
      {view.experiences.length > 0 && <ExperienceTimeline entries={view.experiences} meta={view.experienceMeta} />}
      {view.education.length > 0 && <EducationList entries={view.education} />}
      {view.projects.length > 0 && <ProjectsGrid entries={view.projects} />}
      {view.skillGroups.length > 0 && <SkillsGroups groups={view.skillGroups} meta={view.skillsMeta} />}
    </JourneyFrame>
  );
}
