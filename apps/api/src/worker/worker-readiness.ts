import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";

export const WORKER_READY_FILE = join(tmpdir(), "helpmegethired-worker.ready");

// The worker listens on no port, so its health check looks for the file written once every
// consumer is registered and removed when the process shuts down.
@Injectable()
export class WorkerReadiness implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerReadiness.name);

  async onApplicationBootstrap(): Promise<void> {
    await writeFile(WORKER_READY_FILE, new Date().toISOString());
    this.logger.log(`Ready, marked at ${WORKER_READY_FILE}`);
  }

  onApplicationShutdown(): Promise<void> {
    return rm(WORKER_READY_FILE, { force: true });
  }
}
