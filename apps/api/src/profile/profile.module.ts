import { Module } from "@nestjs/common";

import { Clock, SystemClock } from "../common/clock";
import { IngestionModule } from "../ingestion/ingestion.module";
import { ResumesModule } from "../resumes/resumes.module";
import { ProfileController } from "./profile.controller";
import { ProfileRepository } from "./profile.repository";
import { ProfileService } from "./profile.service";

@Module({
  imports: [IngestionModule, ResumesModule],
  controllers: [ProfileController],
  providers: [ProfileRepository, ProfileService, { provide: Clock, useClass: SystemClock }],
  exports: [ProfileRepository, ProfileService],
})
export class ProfileModule {}
