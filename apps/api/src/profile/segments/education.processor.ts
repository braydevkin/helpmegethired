import { Injectable } from "@nestjs/common";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { extractEducation } from "../../parser";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedEducation } from "./recognized";
import { ResumeSegmentProcessor, ownLinesOf, type ResumeSegmentContent } from "./resume-segment.processor";

@Injectable()
export class EducationSegmentProcessor extends ResumeSegmentProcessor<RecognizedEducation> {
  readonly kind = "education";

  constructor(
    resumes: UploadedResumeRunRepository,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes);
  }

  recognize(content: ResumeSegmentContent): Promise<RecognizedEducation> {
    return Promise.resolve({ education: extractEducation(ownLinesOf(content, "education")) });
  }

  save(recognized: RecognizedEducation, context: SegmentContext): Promise<void> {
    return this.profiles.saveEducation(context, recognized.education);
  }
}
