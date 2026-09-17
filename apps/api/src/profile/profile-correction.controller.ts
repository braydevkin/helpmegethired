import { Body, Controller, Delete, Param, Post, Put, UseFilters } from "@nestjs/common";
import {
  BasicProfileSchema,
  IdSchema,
  ProfileListPartSchema,
  type Account,
  type BasicProfile,
  type Id,
  type Profile,
  type ProfileListPart,
} from "@helpmegethired/shared";

import { CurrentAccount } from "../auth/current-account.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ProfileCorrectionService } from "./profile-correction.service";
import { ProfileErrorFilter } from "./profile-error.filter";

const partPipe = new ZodValidationPipe(ProfileListPartSchema);
const idPipe = new ZodValidationPipe(IdSchema);

// The entry itself is validated by the part that receives it, which is the only place that
// knows what an Experience, a Skill, or a Certification may say.
@Controller("profile/parts")
@UseFilters(ProfileErrorFilter)
export class ProfileCorrectionController {
  constructor(private readonly corrections: ProfileCorrectionService) {}

  @Put("basic-profile")
  correctBasicProfile(
    @CurrentAccount() account: Account,
    @Body(new ZodValidationPipe(BasicProfileSchema)) basicProfile: BasicProfile,
  ): Promise<Profile> {
    return this.corrections.correctBasicProfile(account.id, basicProfile);
  }

  @Post(":part")
  addEntry(@CurrentAccount() account: Account, @Param("part", partPipe) part: ProfileListPart, @Body() entry: unknown): Promise<Profile> {
    return this.corrections.addEntry(account.id, part, entry);
  }

  @Put(":part/:id")
  replaceEntry(
    @CurrentAccount() account: Account,
    @Param("part", partPipe) part: ProfileListPart,
    @Param("id", idPipe) entryId: Id,
    @Body() entry: unknown,
  ): Promise<Profile> {
    return this.corrections.replaceEntry(account.id, part, entryId, entry);
  }

  @Delete(":part/:id")
  removeEntry(
    @CurrentAccount() account: Account,
    @Param("part", partPipe) part: ProfileListPart,
    @Param("id", idPipe) entryId: Id,
  ): Promise<Profile> {
    return this.corrections.removeEntry(account.id, part, entryId);
  }
}
