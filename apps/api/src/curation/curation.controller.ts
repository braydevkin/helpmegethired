import { Controller, Get, Headers, HttpStatus, Res } from "@nestjs/common";
import type { Account, CurationProgressState } from "@helpmegethired/shared";
import type { Response } from "express";

import { CurrentAccount } from "../auth/current-account.decorator";
import { etagOf } from "./curation-progress";
import { CurationProgressService } from "./curation-progress.service";

@Controller("profile/curation")
export class CurationController {
  constructor(private readonly progress: CurationProgressService) {}

  @Get()
  async get(
    @CurrentAccount() account: Account,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurationProgressState | undefined> {
    const state = await this.progress.progressOf(account.id);
    const etag = etagOf(state);

    response.setHeader("ETag", etag);

    if (ifNoneMatch === etag) {
      response.status(HttpStatus.NOT_MODIFIED);

      return undefined;
    }

    return state;
  }
}
