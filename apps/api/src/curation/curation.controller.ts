import { Controller, Get, Headers, HttpCode, HttpStatus, Post, Res, UseFilters } from "@nestjs/common";
import type { Account, CurationProgressState } from "@helpmegethired/shared";
import type { Response } from "express";

import { CurrentAccount } from "../auth/current-account.decorator";
import { CurationActionErrorFilter } from "./curation-action-error.filter";
import { CurationActions } from "./curation-actions";
import { etagOf } from "./curation-progress";
import { CurationProgressService } from "./curation-progress.service";

@Controller("profile/curation")
@UseFilters(CurationActionErrorFilter)
export class CurationController {
  constructor(
    private readonly progress: CurationProgressService,
    private readonly actions: CurationActions,
  ) {}

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

  @Post("cancel")
  @HttpCode(HttpStatus.OK)
  async cancel(@CurrentAccount() account: Account): Promise<CurationProgressState> {
    await this.actions.cancel(account.id);

    return this.progress.progressOf(account.id);
  }

  @Post("retry")
  @HttpCode(HttpStatus.ACCEPTED)
  async retry(@CurrentAccount() account: Account): Promise<CurationProgressState> {
    await this.actions.retry(account.id);

    return this.progress.progressOf(account.id);
  }

  @Post("rerun")
  @HttpCode(HttpStatus.ACCEPTED)
  async rerun(@CurrentAccount() account: Account): Promise<CurationProgressState> {
    await this.actions.rerun(account.id);

    return this.progress.progressOf(account.id);
  }
}
