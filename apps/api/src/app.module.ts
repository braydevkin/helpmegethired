import { Module } from "@nestjs/common";

import { AnalysisModule } from "./analysis/analysis.module";
import { AuthModule } from "./auth/auth.module";
import { EnvironmentModule } from "./config/environment.module";
import { DatabaseModule } from "./database/database.module";
import { DocsModule } from "./docs/docs.module";
import { HealthModule } from "./health/health.module";
import { IngestionModule } from "./ingestion/ingestion.module";
import { InterviewModule } from "./interview/interview.module";
import { JobDescriptionsModule } from "./job-descriptions/job-descriptions.module";
import { LearningsModule } from "./learnings/learnings.module";
import { ModelChoiceModule } from "./model-choice/model-choice.module";
import { ProfileModule } from "./profile/profile.module";
import { ResumesModule } from "./resumes/resumes.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    EnvironmentModule,
    DatabaseModule,
    StorageModule,
    HealthModule,
    DocsModule,
    AuthModule,
    ModelChoiceModule,
    ProfileModule,
    IngestionModule,
    ResumesModule,
    JobDescriptionsModule,
    AnalysisModule,
    LearningsModule,
    InterviewModule,
  ],
})
export class AppModule {}
