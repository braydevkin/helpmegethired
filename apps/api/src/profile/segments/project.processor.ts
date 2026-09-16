import { Injectable } from "@nestjs/common";
import type { SegmentRecognition } from "@helpmegethired/shared";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { extractProjects } from "../../parser";
import { SegmentModelReader } from "../../recognition/segment-model-reader";
import { verifyProject } from "../../recognition/verification";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedProject } from "./recognized";
import { ResumeSegmentProcessor, ownLinesOf, type ResumeSegmentContent } from "./resume-segment.processor";

@Injectable()
export class ProjectSegmentProcessor extends ResumeSegmentProcessor<"project", RecognizedProject> {
  readonly kind = "project";

  constructor(
    resumes: UploadedResumeRunRepository,
    modelReader: SegmentModelReader,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes, modelReader);
  }

  protected override linesOf(content: ResumeSegmentContent): string[] {
    return ownLinesOf(content, "projects");
  }

  protected recognizeByRules(lines: string[]): Promise<RecognizedProject> {
    return Promise.resolve({ projects: extractProjects(lines) });
  }

  protected verify(lines: readonly string[], byRules: RecognizedProject, byModel: SegmentRecognition<"project">): RecognizedProject {
    return verifyProject(lines, byRules, byModel);
  }

  save(recognized: RecognizedProject, context: SegmentContext): Promise<void> {
    return this.profiles.saveProjects(context, recognized.projects);
  }
}
