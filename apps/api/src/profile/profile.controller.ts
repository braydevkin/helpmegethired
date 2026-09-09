import { Controller, Get, HttpCode, HttpStatus, Post, UseFilters } from "@nestjs/common";
import type { Account, Profile } from "@helpmegethired/shared";

import { CurrentAccount } from "../auth/current-account.decorator";
import { ProfileErrorFilter } from "./profile-error.filter";
import { ProfileService } from "./profile.service";

@Controller("profile")
@UseFilters(ProfileErrorFilter)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  get(@CurrentAccount() account: Account): Promise<Profile> {
    return this.profiles.get(account.id);
  }

  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentAccount() account: Account): Promise<Profile> {
    return this.profiles.confirm(account.id);
  }
}
