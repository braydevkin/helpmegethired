import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Put, UseFilters } from "@nestjs/common";
import {
  ModelChoiceRequestSchema,
  type Account,
  type AccountModelChoice,
  type ModelChoiceErrorCode,
  type ModelChoiceRequest,
  type ModelChoiceState,
} from "@helpmegethired/shared";
import type { ZodError } from "zod";

import { CurrentAccount } from "../auth/current-account.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ModelChoiceErrorFilter } from "./model-choice-error.filter";
import { ModelChoiceService } from "./model-choice.service";

const CHOICE_FIELDS: readonly PropertyKey[] = ["provider", "modelId"];

const unsupportedChoiceOf = (error: ZodError): ModelChoiceErrorCode | undefined =>
  error.issues.some((issue) => CHOICE_FIELDS.includes(issue.path[0] ?? "")) ? "unsupported_model_choice" : undefined;

@Controller("account/model")
@UseFilters(ModelChoiceErrorFilter)
export class ModelChoiceController {
  constructor(private readonly choices: ModelChoiceService) {}

  @Get()
  get(@CurrentAccount() account: Account): Promise<ModelChoiceState> {
    return this.choices.get(account.id);
  }

  @Put()
  save(
    @CurrentAccount() account: Account,
    @Body(new ZodValidationPipe(ModelChoiceRequestSchema, unsupportedChoiceOf)) request: ModelChoiceRequest,
  ): Promise<AccountModelChoice> {
    return this.choices.save(account.id, request);
  }

  @Delete("key")
  @HttpCode(HttpStatus.OK)
  revokeKey(@CurrentAccount() account: Account): Promise<AccountModelChoice> {
    return this.choices.revokeKey(account.id);
  }
}
