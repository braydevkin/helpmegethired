import { Injectable } from "@nestjs/common";
import type { SegmentRecognition } from "@helpmegethired/shared";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { extractEducation } from "../../parser";
import { SegmentModelReader } from "../../recognition/segment-model-reader";
import { verifyEducation } from "../../recognition/verification";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedEducation } from "./recognized";
import { ResumeSegmentProcessor, ownLinesOf, type ResumeSegmentContent } from "./resume-segment.processor";

@Injectable()
export class EducationSegmentProcessor extends ResumeSegmentProcessor<"education", RecognizedEducation> {
  readonly kind = "education";

  constructor(
    resumes: UploadedResumeRunRepository,
    modelReader: SegmentModelReader,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes, modelReader);
  }

  protected override linesOf(content: ResumeSegmentContent): string[] {
    return ownLinesOf(content, "education");
  }

  protected recognizeByRules(lines: string[]): Promise<RecognizedEducation> {
    return Promise.resolve({ education: extractEducation(lines) });
  }

  protected verify(lines: readonly string[], byRules: RecognizedEducation, byModel: SegmentRecognition<"education">): RecognizedEducation {
    return verifyEducation(lines, byRules, byModel);
  }

  save(recognized: RecognizedEducation, context: SegmentContext): Promise<void> {
    return this.profiles.saveEducation(context, recognized.education);
  }
}
