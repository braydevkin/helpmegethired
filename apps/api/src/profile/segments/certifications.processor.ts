import { Injectable } from "@nestjs/common";
import type { SegmentRecognition } from "@helpmegethired/shared";

import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { certificationsOf, splitSections } from "../../parser";
import { SegmentModelReader } from "../../recognition/segment-model-reader";
import { verifyCertifications } from "../../recognition/verification";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedCertifications } from "./recognized";
import { ResumeSegmentProcessor } from "./resume-segment.processor";

@Injectable()
export class CertificationsSegmentProcessor extends ResumeSegmentProcessor<"certifications", RecognizedCertifications> {
  readonly kind = "certifications";

  constructor(
    resumes: UploadedResumeRunRepository,
    modelReader: SegmentModelReader,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes, modelReader);
  }

  protected recognizeByRules(lines: readonly string[]): Promise<RecognizedCertifications> {
    return Promise.resolve({ certifications: certificationsOf(splitSections(lines)) });
  }

  protected verify(lines: readonly string[], byRules: RecognizedCertifications, byModel: SegmentRecognition<"certifications">): RecognizedCertifications {
    return verifyCertifications(lines, byRules, byModel);
  }

  save(recognized: RecognizedCertifications, context: SegmentContext): Promise<void> {
    return this.profiles.saveCertifications(context, recognized.certifications);
  }
}
