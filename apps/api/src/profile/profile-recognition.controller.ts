import { Controller, HttpCode, HttpStatus, Post, UseFilters } from "@nestjs/common";
import type { Account, ProfileRecognitionReceipt } from "@helpmegethired/shared";

import { CurrentAccount } from "../auth/current-account.decorator";
import { ProfileRecognitionErrorFilter } from "./profile-recognition-error.filter";
import { ProfileRecognitionService } from "./profile-recognition.service";

@Controller("profile/recognition")
@UseFilters(ProfileRecognitionErrorFilter)
export class ProfileRecognitionController {
  constructor(private readonly recognition: ProfileRecognitionService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  start(@CurrentAccount() account: Account): Promise<ProfileRecognitionReceipt> {
    return this.recognition.start(account.id);
  }
}
