import { Module } from "@nestjs/common";

import { EnvironmentModule } from "../config/environment.module";
import { DatabaseModule } from "../database/database.module";
import { ExtractionModule } from "../extraction/extraction.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { ResumesModule } from "../resumes/resumes.module";
import { IngestionWorker } from "./ingestion.worker";
import { ResumeExtractionWorker } from "./resume-extraction.worker";
import { WorkerReadiness } from "./worker-readiness";

@Module({
  imports: [EnvironmentModule, DatabaseModule, IngestionModule, ResumesModule, ExtractionModule],
  providers: [IngestionWorker, ResumeExtractionWorker, WorkerReadiness],
})
export class WorkerModule {}
