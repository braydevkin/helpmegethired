import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from "@nestjs/common";
import { AccountInformationSchema, type Account, type AccountInformation } from "@helpmegethired/shared";

import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CurrentAccount, CurrentSessionToken } from "./current-account.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("sign-out")
  @HttpCode(HttpStatus.NO_CONTENT)
  signOut(@CurrentSessionToken() token: string): Promise<void> {
    return this.authService.signOut(token);
  }

  @Get("account")
  account(@CurrentAccount() account: Account): Account {
    return account;
  }

  @Patch("account")
  updateAccount(
    @CurrentAccount() account: Account,
    @Body(new ZodValidationPipe(AccountInformationSchema)) information: AccountInformation,
  ): Promise<Account> {
    return this.authService.updateInformation(account, information);
  }
}
