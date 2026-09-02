import { Inject, Logger, Module, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PgBoss, fromKysely } from "pg-boss";

import { DATABASE, type Database } from "../database/database";

const STOP_TIMEOUT_MS = 10_000;

const pgBossProvider = {
  provide: PgBoss,
  useFactory: (database: Database) => new PgBoss({ db: fromKysely(database), schedule: false }),
  inject: [DATABASE],
};

@Module({
  providers: [pgBossProvider],
  exports: [PgBoss],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueModule.name);

  constructor(@Inject(PgBoss) private readonly boss: PgBoss) {}

  async onModuleInit(): Promise<void> {
    this.boss.on("error", (error) => this.logger.error(error));

    await this.boss.start();
  }

  onModuleDestroy(): Promise<void> {
    return this.boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS });
  }
}
