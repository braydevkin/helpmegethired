import { Module } from "@nestjs/common";

import { Clock, SystemClock } from "../common/clock";
import { CurationModule } from "../curation/curation.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { ResumesModule } from "../resumes/resumes.module";
import { ProfileController } from "./profile.controller";
import { ProfileCorrectionController } from "./profile-correction.controller";
import { ProfileCorrectionRepository } from "./profile-correction.repository";
import { ProfileCorrectionService } from "./profile-correction.service";
import { ProfileRepository } from "./profile.repository";
import { ProfileService } from "./profile.service";

@Module({
  imports: [IngestionModule, ResumesModule, CurationModule],
  controllers: [ProfileController, ProfileCorrectionController],
  providers: [ProfileRepository, ProfileCorrectionRepository, ProfileCorrectionService, ProfileService, { provide: Clock, useClass: SystemClock }],
  exports: [ProfileRepository, ProfileService],
})
export class ProfileModule {}
