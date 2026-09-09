import { Injectable } from "@nestjs/common";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { extractLanguages } from "../../parser";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedLanguages } from "./recognized";
import { ResumeSegmentProcessor, ownLinesOf, type ResumeSegmentContent } from "./resume-segment.processor";

@Injectable()
export class LanguagesSegmentProcessor extends ResumeSegmentProcessor<RecognizedLanguages> {
  readonly kind = "languages";

  constructor(
    resumes: UploadedResumeRunRepository,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes);
  }

  recognize(content: ResumeSegmentContent): Promise<RecognizedLanguages> {
    return Promise.resolve({ languages: extractLanguages(ownLinesOf(content, "languages")) });
  }

  save(recognized: RecognizedLanguages, context: SegmentContext): Promise<void> {
    return this.profiles.saveLanguages(context, recognized.languages);
  }
}
