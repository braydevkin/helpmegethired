import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { ApiError, CurationActionErrorCode } from "@helpmegethired/shared";
import type { Response } from "express";

import { CurationActionRefusedError } from "./curation-errors";

const STATUS_OF: Record<CurationActionErrorCode, HttpStatus> = {
  curation_active: HttpStatus.CONFLICT,
  curation_not_found: HttpStatus.NOT_FOUND,
  curation_not_ready: HttpStatus.UNPROCESSABLE_ENTITY,
  curation_not_retryable: HttpStatus.UNPROCESSABLE_ENTITY,
  curation_model_changed: HttpStatus.UNPROCESSABLE_ENTITY,
  curation_unchanged: HttpStatus.UNPROCESSABLE_ENTITY,
};

const ERROR_NAME_OF: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.CONFLICT]: "Conflict",
  [HttpStatus.NOT_FOUND]: "Not Found",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "Unprocessable Entity",
};

export function apiErrorOf(error: CurationActionRefusedError): ApiError {
  const statusCode = STATUS_OF[error.code];

  return { statusCode, message: error.message, error: ERROR_NAME_OF[statusCode], code: error.code };
}

@Catch(CurationActionRefusedError)
export class CurationActionErrorFilter implements ExceptionFilter<CurationActionRefusedError> {
  catch(error: CurationActionRefusedError, host: ArgumentsHost): void {
    const body = apiErrorOf(error);

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
