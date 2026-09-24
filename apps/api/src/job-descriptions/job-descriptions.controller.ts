import { Body, Controller, Get, HttpStatus, Param, Post, Res, UseFilters } from "@nestjs/common";
import { IdSchema, JobDescriptionPasteSchema, type Account, type Id, type JobDescriptionOverview, type JobDescriptionOverviewList, type JobDescriptionPaste } from "@helpmegethired/shared";
import type { Response } from "express";
import type { ZodError } from "zod";

import { CurrentAccount } from "../auth/current-account.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JobDescriptionErrorFilter } from "./job-description-error.filter";
import { JobDescriptionsService } from "./job-descriptions.service";

// The one validation failure the page acts on differently: a paste over the cap is told so.
const tooLongOf = (error: ZodError): string | undefined => (error.issues.some((issue) => issue.code === "too_big") ? "job_description_too_long" : undefined);

@Controller("job-descriptions")
@UseFilters(JobDescriptionErrorFilter)
export class JobDescriptionsController {
  constructor(private readonly jobDescriptions: JobDescriptionsService) {}

  // 201 for a new Job Description, 200 for the one the same text already kept.
  @Post()
  async paste(
    @CurrentAccount() account: Account,
    @Body(new ZodValidationPipe(JobDescriptionPasteSchema, tooLongOf)) paste: JobDescriptionPaste,
    @Res({ passthrough: true }) response: Response,
  ): Promise<JobDescriptionOverview> {
    const pasted = await this.jobDescriptions.paste(account.id, paste.text);

    response.status(pasted.created ? HttpStatus.CREATED : HttpStatus.OK);

    return pasted.overview;
  }

  @Get()
  list(@CurrentAccount() account: Account): Promise<JobDescriptionOverviewList> {
    return this.jobDescriptions.list(account.id);
  }

  @Get(":id")
  read(@CurrentAccount() account: Account, @Param("id", new ZodValidationPipe(IdSchema)) id: Id): Promise<JobDescriptionOverview> {
    return this.jobDescriptions.read(account.id, id);
  }
}
