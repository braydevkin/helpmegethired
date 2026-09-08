import { Module, type OnModuleInit } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ExtractionModule } from "../extraction/extraction.module";
import { IngestionObservers } from "../ingestion/ingestion-observer";
import { IngestionModule } from "../ingestion/ingestion.module";
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

const PROCESSORS = [
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
  providers: [...PROCESSORS, ResumeIngestionObserver],
})
export class ProfileIngestionModule implements OnModuleInit {
  constructor(
    private readonly registry: SegmentProcessorRegistry,
    private readonly observers: IngestionObservers,
    private readonly observer: ResumeIngestionObserver,
    private readonly header: HeaderSegmentProcessor,
    private readonly experience: ExperienceSegmentProcessor,
    private readonly education: EducationSegmentProcessor,
    private readonly project: ProjectSegmentProcessor,
    private readonly skills: SkillsSegmentProcessor,
    private readonly languages: LanguagesSegmentProcessor,
    private readonly certifications: CertificationsSegmentProcessor,
  ) {}

  onModuleInit(): void {
    for (const processor of [this.header, this.experience, this.education, this.project, this.skills, this.languages, this.certifications]) {
      this.registry.register(processor);
    }

    this.observers.register(this.observer);
  }
}
