import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CredentialsSchema, type Account, type AuthenticatedAccount, type Credentials } from "@helpmegethired/shared";

import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";
import { CurrentAccount, CurrentSessionToken } from "./current-account.decorator";
import { Public } from "./public.decorator";

const credentialsBody = new ZodValidationPipe(CredentialsSchema);

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("sign-up")
  signUp(@Body(credentialsBody) credentials: Credentials): Promise<AuthenticatedAccount> {
    return this.authService.signUp(credentials);
  }

  @Public()
  @Post("sign-in")
  @HttpCode(HttpStatus.OK)
  signIn(@Body(credentialsBody) credentials: Credentials): Promise<AuthenticatedAccount> {
    return this.authService.signIn(credentials);
  }

  @Post("sign-out")
  @HttpCode(HttpStatus.NO_CONTENT)
  signOut(@CurrentSessionToken() token: string): Promise<void> {
    return this.authService.signOut(token);
  }

  @Get("account")
  account(@CurrentAccount() account: Account): Account {
    return account;
  }
}
