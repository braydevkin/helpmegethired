import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AccountRepository } from "./account.repository";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordHasher } from "./password-hasher";
import { ScryptPasswordHasher } from "./scrypt-password-hasher";
import { SessionGuard } from "./session.guard";
import { SessionRepository } from "./session.repository";

@Module({
  controllers: [AuthController],
  providers: [
    AccountRepository,
    SessionRepository,
    AuthService,
    { provide: PasswordHasher, useClass: ScryptPasswordHasher },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [AccountRepository, AuthService],
})
export class AuthModule {}
