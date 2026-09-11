import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Put, UseFilters } from "@nestjs/common";
import {
  ModelChoiceRequestSchema,
  type Account,
  type AccountModelChoice,
  type ModelChoiceErrorCode,
  type ModelChoiceRequest,
  type ModelChoiceState,
  type ModelKeyTicket,
} from "@helpmegethired/shared";
import type { ZodError } from "zod";

import { CurrentAccount } from "../auth/current-account.decorator";
import { AcceptsRouteCredential } from "../auth/route-credential.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ModelChoiceErrorFilter } from "./model-choice-error.filter";
import { ModelChoiceService } from "./model-choice.service";
import { ModelKeyTicketGuard } from "./model-key-ticket.guard";
import { ModelKeyTicketService } from "./model-key-ticket.service";

const CHOICE_FIELDS: readonly PropertyKey[] = ["provider", "modelId"];

const unsupportedChoiceOf = (error: ZodError): ModelChoiceErrorCode | undefined =>
  error.issues.some((issue) => CHOICE_FIELDS.includes(issue.path[0] ?? "")) ? "unsupported_model_choice" : undefined;

@Controller("account/model")
@UseFilters(ModelChoiceErrorFilter)
export class ModelChoiceController {
  constructor(
    private readonly choices: ModelChoiceService,
    private readonly tickets: ModelKeyTicketService,
  ) {}

  @Get()
  get(@CurrentAccount() account: Account): Promise<ModelChoiceState> {
    return this.choices.get(account.id);
  }

  // The page sends the key here itself with a Model Key ticket, because the key must never pass
  // through the web app (ADR-0023) and the browser holds no Session token.
  @Put()
  @AcceptsRouteCredential(ModelKeyTicketGuard)
  save(
    @CurrentAccount() account: Account,
    @Body(new ZodValidationPipe(ModelChoiceRequestSchema, unsupportedChoiceOf)) request: ModelChoiceRequest,
  ): Promise<AccountModelChoice> {
    return this.choices.save(account.id, request);
  }

  @Post("key-ticket")
  issueKeyTicket(@CurrentAccount() account: Account): Promise<ModelKeyTicket> {
    return this.tickets.issue(account.id);
  }

  @Delete("key")
  @HttpCode(HttpStatus.OK)
  revokeKey(@CurrentAccount() account: Account): Promise<AccountModelChoice> {
    return this.choices.revokeKey(account.id);
  }
}
