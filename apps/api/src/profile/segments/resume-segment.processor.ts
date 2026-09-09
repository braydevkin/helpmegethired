import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import { SegmentProcessor } from "../../ingestion/segment-processor";
import { partitionLabelled, type SectionKind } from "../../parser";
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

// The read Step every resume kind shares: the stored text, cleaned, sliced by the Segment's
// ranges, with each labelled paragraph joined into one line.
export abstract class ResumeSegmentProcessor<Recognized> extends SegmentProcessor<ResumeSegmentInput, ResumeSegmentContent, Recognized> {
  abstract override readonly kind: ResumeSegmentKind;

  constructor(private readonly resumes: UploadedResumeRunRepository) {
    super();
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
    const slice = (range: { start: number; end: number }) => lines.slice(range.start, range.end);

    return {
      lines: [...input.ranges.flatMap(slice), ...input.paragraphs.map((range) => slice(range).join(" "))],
    };
  }
}

// The lines that belong to the kind itself, with a labelled paragraph of another kind left out
// and the kind's own label stripped.
export const ownLinesOf = (content: ResumeSegmentContent, kind: SectionKind): string[] =>
  partitionLabelled(content.lines, kind).own;
