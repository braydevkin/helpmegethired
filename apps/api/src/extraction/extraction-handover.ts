import { Injectable } from "@nestjs/common";

import { UploadedResumeRunRepository, type ExtractionRecord } from "./uploaded-resume-run.repository";

// What happens to a record once its text is stored and its object deleted.
export abstract class ExtractionHandover {
  abstract handOver(record: ExtractionRecord): Promise<void>;
}

// #79 replaces this with the section splitter and the Ingestion built from the stored text.
@Injectable()
export class MarkDoneHandover extends ExtractionHandover {
  constructor(private readonly repository: UploadedResumeRunRepository) {
    super();
  }

  handOver(record: ExtractionRecord): Promise<void> {
    return this.repository.markDone(record.id);
  }
}
