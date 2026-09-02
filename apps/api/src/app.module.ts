import { Module } from "@nestjs/common";

import { AnalysisModule } from "./analysis/analysis.module";
import { AuthModule } from "./auth/auth.module";
import { EnvironmentModule } from "./config/environment.module";
import { HealthModule } from "./health/health.module";
import { IngestionModule } from "./ingestion/ingestion.module";
import { InterviewModule } from "./interview/interview.module";
import { JobDescriptionsModule } from "./job-descriptions/job-descriptions.module";
import { LearningsModule } from "./learnings/learnings.module";
import { ProfileModule } from "./profile/profile.module";

@Module({
  imports: [
    EnvironmentModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    IngestionModule,
    JobDescriptionsModule,
    AnalysisModule,
    LearningsModule,
    InterviewModule,
  ],
})
export class AppModule {}
