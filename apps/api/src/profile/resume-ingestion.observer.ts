import { Injectable, Logger } from "@nestjs/common";
import type { Ingestion } from "@helpmegethired/shared";

import { CurationRepository } from "../curation/curation.repository";
import type { Database } from "../database/database";
import { UploadedResumeRunRepository } from "../extraction/uploaded-resume-run.repository";
import { IngestionObserver } from "../ingestion/ingestion-observer";
import { ProfileRepository } from "./profile.repository";

const FAILED_MESSAGE = "The Ingestion used every attempt";

// The end of a resume Ingestion: on completion the Curations of the earlier Profile are superseded
// with their Statements, the earlier resume Ingestions' rows go and the Uploaded Resume is done; on
// failure the Uploaded Resume fails with profile_build_failed and the previous Profile stays as it was.
@Injectable()
export class ResumeIngestionObserver extends IngestionObserver {
  private readonly logger = new Logger(ResumeIngestionObserver.name);

  constructor(
    private readonly profiles: ProfileRepository,
    private readonly resumes: UploadedResumeRunRepository,
    private readonly curations: CurationRepository,
  ) {
    super();
  }

  async completed(ingestion: Ingestion, transaction: Database): Promise<void> {
    const superseded = await this.curations.supersedeEarlierThan(ingestion.accountId, ingestion.id, transaction);

    await this.profiles.deleteRowsOfEarlierIngestions(ingestion.accountId, ingestion.source, ingestion.id, transaction);
    await this.resumes.markDoneByIngestion(ingestion.id, transaction);

    for (const curationId of superseded) {
      this.logger.log(`curation superseded curation=${curationId} ingestion=${ingestion.id}`);
    }
  }

  async failed(ingestion: Ingestion): Promise<void> {
    await this.resumes.failByIngestion(ingestion.id, "profile_build_failed", ingestion.lastError ?? FAILED_MESSAGE);
  }
}
