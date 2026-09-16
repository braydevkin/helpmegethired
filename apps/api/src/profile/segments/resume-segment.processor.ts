import type { SegmentRecognition } from "@helpmegethired/shared";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import { SegmentProcessor, type SegmentContext } from "../../ingestion/segment-processor";
import { SegmentModelReader } from "../../recognition/segment-model-reader";
import { UploadedResumeNotFoundError } from "../../resumes/resume-errors";
import { cleanedLinesOf, type ResumeSegmentInput, type ResumeSegmentKind } from "./resume-segments";

export interface ResumeSegmentContent {
  lines: string[];
}

export class ResumeTextMissingError extends Error {
  constructor(uploadedResumeId: string) {
    super(`The Uploaded Resume ${uploadedResumeId} holds no extracted text`);
    this.name = "ResumeTextMissingError";
  }
}

// What every resume kind shares. The read Step: the stored text, cleaned, sliced by the
// Segment's ranges. The recognize Step: the kind's rules read those lines their own way, the
// Candidate's Model reads the same lines when the Account holds a Model Key, and the kind's rules
// verify the Model's reading into the rules' shape.
export abstract class ResumeSegmentProcessor<Kind extends ResumeSegmentKind, Recognized> extends SegmentProcessor<
  ResumeSegmentInput,
  ResumeSegmentContent,
  Recognized
> {
  abstract override readonly kind: Kind;

  constructor(
    private readonly resumes: UploadedResumeRunRepository,
    private readonly modelReader: SegmentModelReader,
  ) {
    super();
  }

  protected abstract recognizeByRules(lines: readonly string[], context: SegmentContext): Promise<Recognized>;

  protected abstract verify(lines: readonly string[], byRules: Recognized, byModel: SegmentRecognition<Kind>): Recognized;

  async recognize({ lines }: ResumeSegmentContent, context: SegmentContext): Promise<Recognized> {
    const byRules = await this.recognizeByRules(lines, context);
    const byModel = await this.modelReader.read({ accountId: context.accountId, kind: this.kind, lines });

    return byModel === null ? byRules : this.verify(lines, byRules, byModel);
  }

  async read(input: ResumeSegmentInput): Promise<ResumeSegmentContent> {
    const record = await this.resumes.findById(input.uploadedResumeId);

    if (!record) {
      throw new UploadedResumeNotFoundError(input.uploadedResumeId);
    }

    if (record.rawText === null) {
      throw new ResumeTextMissingError(input.uploadedResumeId);
    }

    const lines = cleanedLinesOf(record.rawText);

    return { lines: input.ranges.flatMap((range) => lines.slice(range.start, range.end)) };
  }
}
