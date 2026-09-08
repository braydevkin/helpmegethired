import { Injectable } from "@nestjs/common";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { extractProjects } from "../../parser";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedProject } from "./recognized";
import { ResumeSegmentProcessor, ownLinesOf, type ResumeSegmentContent } from "./resume-segment.processor";

@Injectable()
export class ProjectSegmentProcessor extends ResumeSegmentProcessor<RecognizedProject> {
  readonly kind = "project";

  constructor(
    resumes: UploadedResumeRunRepository,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes);
  }

  recognize(content: ResumeSegmentContent): Promise<RecognizedProject> {
    return Promise.resolve({ projects: extractProjects(ownLinesOf(content, "projects")) });
  }

  save(recognized: RecognizedProject, context: SegmentContext): Promise<void> {
    return this.profiles.saveProjects(context, recognized.projects);
  }
}
