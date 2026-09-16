import { Injectable } from "@nestjs/common";
import type { SegmentRecognition } from "@helpmegethired/shared";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { languagesOf, splitSections } from "../../parser";
import { SegmentModelReader } from "../../recognition/segment-model-reader";
import { verifyLanguages } from "../../recognition/verification";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedLanguages } from "./recognized";
import { ResumeSegmentProcessor } from "./resume-segment.processor";

@Injectable()
export class LanguagesSegmentProcessor extends ResumeSegmentProcessor<"languages", RecognizedLanguages> {
  readonly kind = "languages";

  constructor(
    resumes: UploadedResumeRunRepository,
    modelReader: SegmentModelReader,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes, modelReader);
  }

  protected recognizeByRules(lines: readonly string[]): Promise<RecognizedLanguages> {
    return Promise.resolve({ languages: languagesOf(splitSections(lines)) });
  }

  protected verify(lines: readonly string[], byRules: RecognizedLanguages, byModel: SegmentRecognition<"languages">): RecognizedLanguages {
    return verifyLanguages(lines, byRules, byModel);
  }

  save(recognized: RecognizedLanguages, context: SegmentContext): Promise<void> {
    return this.profiles.saveLanguages(context, recognized.languages);
  }
}
