import { Injectable } from "@nestjs/common";
import type { SegmentRecognition } from "@helpmegethired/shared";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { extractExperiences, withSkills } from "../../parser";
import { SegmentModelReader } from "../../recognition/segment-model-reader";
import { verifyExperience } from "../../recognition/verification";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedExperience } from "./recognized";
import { ResumeSegmentProcessor, ownLinesOf, type ResumeSegmentContent } from "./resume-segment.processor";

@Injectable()
export class ExperienceSegmentProcessor extends ResumeSegmentProcessor<"experience", RecognizedExperience> {
  readonly kind = "experience";

  constructor(
    resumes: UploadedResumeRunRepository,
    modelReader: SegmentModelReader,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes, modelReader);
  }

  protected override linesOf(content: ResumeSegmentContent): string[] {
    return ownLinesOf(content, "experience");
  }

  protected recognizeByRules(lines: string[]): Promise<RecognizedExperience> {
    return Promise.resolve({ experiences: extractExperiences(lines).map(withSkills) });
  }

  protected verify(lines: readonly string[], byRules: RecognizedExperience, byModel: SegmentRecognition<"experience">): RecognizedExperience {
    return verifyExperience(lines, byRules, byModel);
  }

  save(recognized: RecognizedExperience, context: SegmentContext): Promise<void> {
    return this.profiles.saveExperiences(context, recognized.experiences);
  }
}
