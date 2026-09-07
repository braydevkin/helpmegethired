import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, type ConnectionOptions } from "bullmq";

import type { EnvironmentConfig } from "../config/environment.module";
import {
  CONSUMER_CONNECTION,
  DEFAULT_QUEUE_PREFIX,
  PRODUCER_CONNECTION,
  PROFILE_INGESTION_QUEUE,
  QUEUE_NAMES,
  QUEUE_PREFIX,
  RECONCILIATION_QUEUE,
  RESUME_EXTRACTION_QUEUE,
  consumerConnectionFor,
  producerConnectionFor,
  type QueueName,
} from "./queues";
import { WORKER_SETTINGS, workerSettingsProvider } from "./worker-settings";

const connectionProvider = (token: symbol, optionsFor: (redisUrl: string) => ConnectionOptions) => ({
  provide: token,
  useFactory: (config: EnvironmentConfig) => optionsFor(config.get("REDIS_URL", { infer: true })),
  inject: [ConfigService],
});

const prefixProvider = { provide: QUEUE_PREFIX, useValue: DEFAULT_QUEUE_PREFIX };

const queueProvider = (token: symbol, name: QueueName) => ({
  provide: token,
  useFactory: (connection: ConnectionOptions, prefix: string) => new Queue(name, { connection, prefix }),
  inject: [PRODUCER_CONNECTION, QUEUE_PREFIX],
});

@Module({
  providers: [
    connectionProvider(PRODUCER_CONNECTION, producerConnectionFor),
    connectionProvider(CONSUMER_CONNECTION, consumerConnectionFor),
    prefixProvider,
    workerSettingsProvider,
    queueProvider(PROFILE_INGESTION_QUEUE, QUEUE_NAMES.profileIngestion),
    queueProvider(RESUME_EXTRACTION_QUEUE, QUEUE_NAMES.resumeExtraction),
    queueProvider(RECONCILIATION_QUEUE, QUEUE_NAMES.reconciliation),
  ],
  exports: [
    CONSUMER_CONNECTION,
    QUEUE_PREFIX,
    WORKER_SETTINGS,
    PROFILE_INGESTION_QUEUE,
    RESUME_EXTRACTION_QUEUE,
    RECONCILIATION_QUEUE,
  ],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(
    @Inject(PROFILE_INGESTION_QUEUE) private readonly profileIngestion: Queue,
    @Inject(RESUME_EXTRACTION_QUEUE) private readonly resumeExtraction: Queue,
    @Inject(RECONCILIATION_QUEUE) private readonly reconciliation: Queue,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([this.profileIngestion.close(), this.resumeExtraction.close(), this.reconciliation.close()]);
  }
}
