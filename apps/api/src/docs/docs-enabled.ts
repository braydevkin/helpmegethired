import { ConfigService } from "@nestjs/config";

import type { Environment } from "../config/environment.schema";

export const DOCS_ENABLED = Symbol("DOCS_ENABLED");

export const docsEnabledProvider = {
  provide: DOCS_ENABLED,
  useFactory: (environment: ConfigService<Environment, true>): boolean => environment.get("NODE_ENV", { infer: true }) !== "production",
  inject: [ConfigService],
};
