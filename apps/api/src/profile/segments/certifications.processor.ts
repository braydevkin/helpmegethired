import { Injectable } from "@nestjs/common";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { extractCertifications } from "../../parser";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedCertifications } from "./recognized";
import { ResumeSegmentProcessor, ownLinesOf, type ResumeSegmentContent } from "./resume-segment.processor";

@Injectable()
export class CertificationsSegmentProcessor extends ResumeSegmentProcessor<RecognizedCertifications> {
  readonly kind = "certifications";

  constructor(
    resumes: UploadedResumeRunRepository,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes);
  }

  recognize(content: ResumeSegmentContent): Promise<RecognizedCertifications> {
    return Promise.resolve({ certifications: extractCertifications(ownLinesOf(content, "certifications")) });
  }

  save(recognized: RecognizedCertifications, context: SegmentContext): Promise<void> {
    return this.profiles.saveCertifications(context, recognized.certifications);
  }
}
