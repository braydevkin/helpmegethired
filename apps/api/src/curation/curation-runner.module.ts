import { Module } from "@nestjs/common";

import { Clock, SystemClock } from "../common/clock";
import { ModelChoiceModule } from "../model-choice/model-choice.module";
import { CurationRunRepository } from "./curation-run.repository";
import { CURATION_RUNNER_SETTINGS, DEFAULT_CURATION_RUNNER_SETTINGS } from "./curation-runner-settings";
import { CurationModule } from "./curation.module";
import { CurationRunner } from "./curation.runner";
import { CurationModelsModule } from "./model/curation-models.module";

// The worker's half of Profile Curation: it reads the Candidate's Model Key and reaches the model,
// so the API process never loads it.
@Module({
  imports: [CurationModule, CurationModelsModule, ModelChoiceModule],
  providers: [
    CurationRunRepository,
    CurationRunner,
    { provide: Clock, useClass: SystemClock },
    { provide: CURATION_RUNNER_SETTINGS, useValue: DEFAULT_CURATION_RUNNER_SETTINGS },
  ],
  exports: [CurationModule, CurationRunner, CurationRunRepository],
})
export class CurationRunnerModule {}
