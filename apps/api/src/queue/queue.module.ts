import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, type ConnectionOptions } from "bullmq";

import type { EnvironmentConfig } from "../config/environment.module";
import {
  DEFAULT_QUEUE_PREFIX,
  PROFILE_INGESTION_QUEUE,
  QUEUE_CONNECTION,
  QUEUE_NAMES,
  QUEUE_PREFIX,
  RESUME_EXTRACTION_QUEUE,
  queueConnectionFor,
  type QueueName,
} from "./queues";

const connectionProvider = {
  provide: QUEUE_CONNECTION,
  useFactory: (config: EnvironmentConfig) => queueConnectionFor(config.get("REDIS_URL", { infer: true })),
  inject: [ConfigService],
};

const prefixProvider = { provide: QUEUE_PREFIX, useValue: DEFAULT_QUEUE_PREFIX };

const queueProvider = (token: symbol, name: QueueName) => ({
  provide: token,
  useFactory: (connection: ConnectionOptions, prefix: string) => new Queue(name, { connection, prefix }),
  inject: [QUEUE_CONNECTION, QUEUE_PREFIX],
});

@Module({
  providers: [
    connectionProvider,
    prefixProvider,
    queueProvider(PROFILE_INGESTION_QUEUE, QUEUE_NAMES.profileIngestion),
    queueProvider(RESUME_EXTRACTION_QUEUE, QUEUE_NAMES.resumeExtraction),
  ],
  exports: [QUEUE_CONNECTION, QUEUE_PREFIX, PROFILE_INGESTION_QUEUE, RESUME_EXTRACTION_QUEUE],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(
    @Inject(PROFILE_INGESTION_QUEUE) private readonly profileIngestion: Queue,
    @Inject(RESUME_EXTRACTION_QUEUE) private readonly resumeExtraction: Queue,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.profileIngestion.close(), this.resumeExtraction.close()]);
  }
}
