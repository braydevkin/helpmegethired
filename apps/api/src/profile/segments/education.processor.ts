import { Injectable } from "@nestjs/common";
import type { SegmentRecognition } from "@helpmegethired/shared";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { educationOf, splitSections } from "../../parser";
import { SegmentModelReader } from "../../recognition/segment-model-reader";
import { verifyEducation } from "../../recognition/verification";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedEducation } from "./recognized";
import { ResumeSegmentProcessor } from "./resume-segment.processor";

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

  protected recognizeByRules(lines: readonly string[]): Promise<RecognizedEducation> {
    return Promise.resolve({ education: educationOf(splitSections(lines)) });
  }

  protected verify(lines: readonly string[], byRules: RecognizedEducation, byModel: SegmentRecognition<"education">): RecognizedEducation {
    return verifyEducation(lines, byRules, byModel);
  }

  save(recognized: RecognizedEducation, context: SegmentContext): Promise<void> {
    return this.profiles.saveEducation(context, recognized.education);
  }
}
