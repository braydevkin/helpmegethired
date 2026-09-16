import { Injectable } from "@nestjs/common";
import type { SegmentRecognition } from "@helpmegethired/shared";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { extractSkills, splitSections } from "../../parser";
import { SegmentModelReader } from "../../recognition/segment-model-reader";
import { verifySkills } from "../../recognition/verification";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedSkills } from "./recognized";
import { ResumeSegmentProcessor } from "./resume-segment.processor";

// Reads the whole text: the Skills are the union of the skills section and every technology
// named inside an Experience or a Project.
@Injectable()
export class SkillsSegmentProcessor extends ResumeSegmentProcessor<"skills", RecognizedSkills> {
  readonly kind = "skills";

  constructor(
    resumes: UploadedResumeRunRepository,
    modelReader: SegmentModelReader,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes, modelReader);
  }

  protected recognizeByRules(lines: string[]): Promise<RecognizedSkills> {
    return Promise.resolve({ skills: extractSkills(splitSections(lines)) });
  }

  protected verify(lines: readonly string[], byRules: RecognizedSkills, byModel: SegmentRecognition<"skills">): RecognizedSkills {
    return verifySkills(lines, byRules, byModel);
  }

  save(recognized: RecognizedSkills, context: SegmentContext): Promise<void> {
    return this.profiles.saveSkills(context, recognized.skills);
  }
}
