import { Injectable } from "@nestjs/common";
import { EMPTY_BASIC_PROFILE, type Id, type Ingestion, type Profile, type ProfileSource } from "@helpmegethired/shared";

import { Clock } from "../common/clock";
import { CurationStarter } from "../curation/curation-starter";
import { IngestionRepository } from "../ingestion/ingestion.repository";
import { careerDuration } from "../parser";
import { UploadedResumeRepository } from "../resumes/uploaded-resume.repository";
import { ProfileNotFoundError } from "./profile-errors";
import { ProfileRepository, type ProfileRows } from "./profile.repository";
import { toBasicProfile } from "./profile.mapper";
import { flagsStillOpen, reviewFlagsOf } from "./review-flags";

export const RESUME_SOURCE = "upload";

@Injectable()
export class ProfileService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly ingestions: IngestionRepository,
    private readonly resumes: UploadedResumeRepository,
    private readonly clock: Clock,
    private readonly curations: CurationStarter,
  ) {}

  // An Account with no completed Ingestion has an empty Profile: the page renders it as such.
  async get(accountId: Id): Promise<Profile> {
    const ingestion = await this.ingestions.findLatestCompleted(accountId, RESUME_SOURCE);

    return ingestion ? this.builtProfile(accountId, ingestion) : emptyProfile(accountId);
  }

  // Confirming records the time once and keeps it on a repeat, so the call is idempotent. With a
  // Model Key already stored, it also starts the Curation (ADR-0024).
  async confirm(accountId: Id): Promise<Profile> {
    const ingestion = await this.ingestions.findLatestCompleted(accountId, RESUME_SOURCE);
    const confirmed = ingestion && (await this.curations.commitAndStart(accountId, (transaction) => this.profiles.confirm(accountId, ingestion.id, transaction)));

    if (!ingestion || !confirmed) {
      throw new ProfileNotFoundError(accountId);
    }

    return this.builtProfile(accountId, ingestion);
  }

  private async builtProfile(accountId: Id, ingestion: Ingestion): Promise<Profile> {
    const rows = await this.profiles.rowsOf(accountId, ingestion.id);
    const confirmedAt = rows.basicProfile?.confirmed_at ?? null;
    const flags = confirmedAt
      ? []
      : flagsStillOpen(reviewFlagsOf(await this.ingestions.segmentsOf(accountId, ingestion.id)), rows.untouchedEntries, rows.corrections);

    return {
      accountId,
      ...partsOf(rows),
      yearsOfExperience: careerDuration(
        rows.experiences.flatMap((experience) => (experience.period ? [experience.period] : [])),
        this.clock.now(),
      ).years,
      reviewFlags: flags,
      corrections: rows.corrections,
      source: await this.sourceOf(accountId, ingestion),
      confirmedAt: confirmedAt?.toISOString() ?? null,
    };
  }

  private async sourceOf(accountId: Id, ingestion: Ingestion): Promise<ProfileSource> {
    const resume = await this.resumes.findByIngestionId(accountId, ingestion.id);

    return {
      kind: ingestion.source,
      uploadedResumeId: resume?.id ?? null,
      fileName: resume?.fileName ?? null,
      ingestionId: ingestion.id,
      completedAt: ingestion.completedAt ?? ingestion.updatedAt,
    };
  }
}

const partsOf = (rows: ProfileRows): Pick<Profile, "basicProfile" | "experiences" | "education" | "projects" | "skills" | "languages" | "certifications"> => ({
  basicProfile: rows.basicProfile ? toBasicProfile(rows.basicProfile) : EMPTY_BASIC_PROFILE,
  experiences: rows.experiences,
  education: rows.education,
  projects: rows.projects,
  skills: rows.skills,
  languages: rows.languages,
  certifications: rows.certifications,
});

const emptyProfile = (accountId: Id): Profile => ({
  accountId,
  basicProfile: EMPTY_BASIC_PROFILE,
  experiences: [],
  education: [],
  projects: [],
  skills: [],
  languages: [],
  certifications: [],
  yearsOfExperience: 0,
  reviewFlags: [],
  corrections: { basicProfile: false, entryIds: [] },
  source: null,
  confirmedAt: null,
});
