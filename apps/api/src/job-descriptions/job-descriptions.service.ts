import { Injectable, Logger } from "@nestjs/common";
import type { Id, JobDescriptionOverview } from "@helpmegethired/shared";

import { CurationRepository } from "../curation/curation.repository";
import { JobDescriptionRefusedError } from "./job-description-errors";
import { JobDescriptionRepository } from "./job-description.repository";

export interface PastedJobDescription {
  overview: JobDescriptionOverview;
  created: boolean;
}

// A Job Description exists to be analysed against the Candidate's Statements, so a paste waits
// for a completed Curation (ADR-0024); it is kept as pasted and never edited (FR-05).
@Injectable()
export class JobDescriptionsService {
  private readonly logger = new Logger(JobDescriptionsService.name);

  constructor(
    private readonly jobDescriptions: JobDescriptionRepository,
    private readonly curations: CurationRepository,
  ) {}

  async paste(accountId: Id, text: string): Promise<PastedJobDescription> {
    if (!(await this.curations.findCurrentCompleted(accountId))) {
      throw new JobDescriptionRefusedError("curation_not_completed", "The Profile must be curated before a Job Description can be analysed; wait for the Curation to complete");
    }

    const kept = await this.jobDescriptions.keep(accountId, text);

    this.logger.log(`job description ${kept.created ? "kept" : "found"} job_description=${kept.id} account=${accountId}`);

    return { overview: await this.read(accountId, kept.id), created: kept.created };
  }

  list(accountId: Id): Promise<JobDescriptionOverview[]> {
    return this.jobDescriptions.overviewsOf(accountId);
  }

  async read(accountId: Id, id: Id): Promise<JobDescriptionOverview> {
    const overview = await this.jobDescriptions.findOverview(accountId, id);

    if (!overview) {
      throw new JobDescriptionRefusedError("job_description_not_found", "No such Job Description");
    }

    return overview;
  }
}
