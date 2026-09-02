import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentConfig } from "../config/environment.module";
import { DATABASE, createDatabase, type Database } from "./database";

const databaseProvider = {
  provide: DATABASE,
  useFactory: (config: EnvironmentConfig) => createDatabase(config.get("DATABASE_URL", { infer: true })),
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [databaseProvider],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  onApplicationShutdown(): Promise<void> {
    return this.database.destroy();
  }
}
