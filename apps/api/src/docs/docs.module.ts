import { Module } from "@nestjs/common";

import { docsEnabledProvider } from "./docs-enabled";
import { DocsController } from "./docs.controller";

@Module({
  controllers: [DocsController],
  providers: [docsEnabledProvider],
})
export class DocsModule {}
