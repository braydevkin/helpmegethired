import { Injectable } from "@nestjs/common";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { extractExperiences, withSkills } from "../../parser";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedExperience } from "./recognized";
import { ResumeSegmentProcessor, ownLinesOf, type ResumeSegmentContent } from "./resume-segment.processor";

@Injectable()
export class ExperienceSegmentProcessor extends ResumeSegmentProcessor<RecognizedExperience> {
  readonly kind = "experience";

  constructor(
    resumes: UploadedResumeRunRepository,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes);
  }

  recognize(content: ResumeSegmentContent): Promise<RecognizedExperience> {
    return Promise.resolve({ experiences: extractExperiences(ownLinesOf(content, "experience")).map(withSkills) });
  }

  save(recognized: RecognizedExperience, context: SegmentContext): Promise<void> {
    return this.profiles.saveExperiences(context, recognized.experiences);
  }
}
