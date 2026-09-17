import { Injectable, type OnModuleInit } from "@nestjs/common";

import { CurationQueue } from "../curation/curation-queue";
import { CurationRunner } from "../curation/curation.runner";

@Injectable()
export class CurationWorker implements OnModuleInit {
  constructor(
    private readonly queue: CurationQueue,
    private readonly runner: CurationRunner,
  ) {}

  onModuleInit(): Promise<void> {
    return this.queue.work((job) => this.runner.run(job.curationId));
  }
}
