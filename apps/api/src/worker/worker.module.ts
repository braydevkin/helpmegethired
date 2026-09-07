import { Module } from "@nestjs/common";

import { EnvironmentModule } from "../config/environment.module";
import { DatabaseModule } from "../database/database.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { IngestionWorker } from "./ingestion.worker";
import { WorkerReadiness } from "./worker-readiness";

@Module({
  imports: [EnvironmentModule, DatabaseModule, IngestionModule],
  providers: [IngestionWorker, WorkerReadiness],
})
export class WorkerModule {}
