import { Injectable } from "@nestjs/common";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { extractSkills, splitSections } from "../../parser";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedSkills } from "./recognized";
import { ResumeSegmentProcessor, type ResumeSegmentContent } from "./resume-segment.processor";

// Reads the whole text: the Skills are the union of the skills section and every technology
// named inside an Experience or a Project.
@Injectable()
export class SkillsSegmentProcessor extends ResumeSegmentProcessor<RecognizedSkills> {
  readonly kind = "skills";

  constructor(
    resumes: UploadedResumeRunRepository,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes);
  }

  recognize(content: ResumeSegmentContent): Promise<RecognizedSkills> {
    return Promise.resolve({ skills: extractSkills(splitSections(content.lines)) });
  }

  save(recognized: RecognizedSkills, context: SegmentContext): Promise<void> {
    return this.profiles.saveSkills(context, recognized.skills);
  }
}
