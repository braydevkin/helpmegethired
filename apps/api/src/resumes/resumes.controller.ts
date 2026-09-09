import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseFilters,
} from "@nestjs/common";
import {
  IdSchema,
  UploadedResumeListQuerySchema,
  type Account,
  type Id,
  type ResumeUpload,
  type ResumeUploadReceipt,
  type UploadedResume,
  type UploadedResumeListQuery,
} from "@helpmegethired/shared";
import type { Response } from "express";

import { CurrentAccount } from "../auth/current-account.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { etagOf } from "./resume-etag";
import { ResumeErrorFilter } from "./resume-error.filter";
import { ResumeUploadPipe } from "./resume-upload.pipe";
import { UploadedResumeService } from "./uploaded-resume.service";

const idPipe = new ZodValidationPipe(IdSchema);

@Controller("resumes")
@UseFilters(ResumeErrorFilter)
export class ResumesController {
  constructor(private readonly resumes: UploadedResumeService) {}

  @Post()
  async request(
    @CurrentAccount() account: Account,
    @Body(new ResumeUploadPipe()) upload: ResumeUpload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ResumeUploadReceipt> {
    const { receipt, created } = await this.resumes.requestUpload(account.id, upload);

    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return receipt;
  }

  @Post(":id/complete")
  @HttpCode(HttpStatus.ACCEPTED)
  complete(@CurrentAccount() account: Account, @Param("id", idPipe) id: Id): Promise<UploadedResume> {
    return this.resumes.complete(account.id, id);
  }

  @Get(":id")
  async findOne(
    @CurrentAccount() account: Account,
    @Param("id", idPipe) id: Id,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UploadedResume | undefined> {
    const resume = await this.resumes.findById(account.id, id);
    const etag = etagOf(resume);

    response.setHeader("ETag", etag);

    if (ifNoneMatch === etag) {
      response.status(HttpStatus.NOT_MODIFIED);

      return undefined;
    }

    return resume;
  }

  @Get()
  list(
    @CurrentAccount() account: Account,
    @Query(new ZodValidationPipe(UploadedResumeListQuerySchema)) query: UploadedResumeListQuery,
  ): Promise<UploadedResume[]> {
    return this.resumes.list(account.id, query.status);
  }
}
