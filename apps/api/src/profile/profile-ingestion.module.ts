import { Inject, Module, type OnModuleInit } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ExtractionModule } from "../extraction/extraction.module";
import { IngestionObservers } from "../ingestion/ingestion-observer";
import { IngestionModule } from "../ingestion/ingestion.module";
import type { AnySegmentProcessor } from "../ingestion/segment-processor";
import { SegmentProcessorRegistry } from "../ingestion/segment-processor.registry";
import { ProfileModule } from "./profile.module";
import { ResumeIngestionObserver } from "./resume-ingestion.observer";
import { CertificationsSegmentProcessor } from "./segments/certifications.processor";
import { EducationSegmentProcessor } from "./segments/education.processor";
import { ExperienceSegmentProcessor } from "./segments/experience.processor";
import { HeaderSegmentProcessor } from "./segments/header.processor";
import { LanguagesSegmentProcessor } from "./segments/languages.processor";
import { ProjectSegmentProcessor } from "./segments/project.processor";
import { SkillsSegmentProcessor } from "./segments/skills.processor";

const RESUME_SEGMENT_PROCESSORS = Symbol("RESUME_SEGMENT_PROCESSORS");

const PROCESSOR_CLASSES = [
  HeaderSegmentProcessor,
  ExperienceSegmentProcessor,
  EducationSegmentProcessor,
  ProjectSegmentProcessor,
  SkillsSegmentProcessor,
  LanguagesSegmentProcessor,
  CertificationsSegmentProcessor,
];

// Loaded by the worker only: the API never runs a Segment.
@Module({
  imports: [AuthModule, IngestionModule, ExtractionModule, ProfileModule],
  providers: [
    ...PROCESSOR_CLASSES,
    ResumeIngestionObserver,
    {
      provide: RESUME_SEGMENT_PROCESSORS,
      useFactory: (...processors: AnySegmentProcessor[]) => processors,
      inject: PROCESSOR_CLASSES,
    },
  ],
})
export class ProfileIngestionModule implements OnModuleInit {
  constructor(
    private readonly registry: SegmentProcessorRegistry,
    private readonly observers: IngestionObservers,
    private readonly observer: ResumeIngestionObserver,
    @Inject(RESUME_SEGMENT_PROCESSORS) private readonly processors: AnySegmentProcessor[],
  ) {}

  onModuleInit(): void {
    for (const processor of this.processors) {
      this.registry.register(processor);
    }

    this.observers.register(this.observer);
  }
}
