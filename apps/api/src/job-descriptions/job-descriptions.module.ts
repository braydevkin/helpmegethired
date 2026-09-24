import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CurationModule } from "../curation/curation.module";
import { JobDescriptionRepository } from "./job-description.repository";
import { JobDescriptionsController } from "./job-descriptions.controller";
import { JobDescriptionsService } from "./job-descriptions.service";

@Module({
  imports: [AuthModule, CurationModule],
  controllers: [JobDescriptionsController],
  providers: [JobDescriptionRepository, JobDescriptionsService],
  exports: [JobDescriptionRepository, JobDescriptionsService],
})
export class JobDescriptionsModule {}
