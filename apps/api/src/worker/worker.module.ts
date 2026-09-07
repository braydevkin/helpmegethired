import { Module } from "@nestjs/common";

import { EnvironmentModule } from "../config/environment.module";
import { DatabaseModule } from "../database/database.module";
import { ExtractionModule } from "../extraction/extraction.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { ReconciliationModule } from "../reconciliation/reconciliation.module";
import { ResumesModule } from "../resumes/resumes.module";
import { IngestionWorker } from "./ingestion.worker";
import { ReconciliationWorker } from "./reconciliation.worker";
import { ResumeExtractionWorker } from "./resume-extraction.worker";
import { WorkerReadiness } from "./worker-readiness";

@Module({
  imports: [EnvironmentModule, DatabaseModule, IngestionModule, ResumesModule, ExtractionModule, ReconciliationModule],
  providers: [IngestionWorker, ResumeExtractionWorker, ReconciliationWorker, WorkerReadiness],
})
export class WorkerModule {}
