import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AccountRepository } from "./account.repository";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionGuard } from "./session.guard";
import { SessionRepository } from "./session.repository";

@Module({
  controllers: [AuthController],
  providers: [AccountRepository, SessionRepository, AuthService, { provide: APP_GUARD, useClass: SessionGuard }],
  exports: [AccountRepository, SessionRepository, AuthService],
})
export class AuthModule {}
