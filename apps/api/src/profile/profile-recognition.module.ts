import { Module } from "@nestjs/common";

import { CurationModule } from "../curation/curation.module";
import { IngestionModule } from "../ingestion/ingestion.module";
import { ModelChoiceModule } from "../model-choice/model-choice.module";
import { ResumesModule } from "../resumes/resumes.module";
import { ProfileRecognitionController } from "./profile-recognition.controller";
import { ProfileRecognitionService } from "./profile-recognition.service";

// Loaded by the API only: the worker runs the Ingestion it starts, never the route.
@Module({
  imports: [ModelChoiceModule, IngestionModule, ResumesModule, CurationModule],
  controllers: [ProfileRecognitionController],
  providers: [ProfileRecognitionService],
})
export class ProfileRecognitionModule {}
