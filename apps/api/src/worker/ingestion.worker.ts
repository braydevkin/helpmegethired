import { Injectable, type OnModuleInit } from "@nestjs/common";

import { IngestionQueue } from "../ingestion/ingestion-queue";
import { IngestionRunner } from "../ingestion/ingestion.runner";

@Injectable()
export class IngestionWorker implements OnModuleInit {
  constructor(
    private readonly queue: IngestionQueue,
    private readonly runner: IngestionRunner,
  ) {}

  onModuleInit(): Promise<void> {
    return this.queue.work((job) => this.runner.run(job.ingestionId));
  }
}
