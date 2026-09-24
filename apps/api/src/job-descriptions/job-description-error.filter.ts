import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { ApiError, JobDescriptionErrorCode } from "@helpmegethired/shared";
import type { Response } from "express";

import { JobDescriptionRefusedError } from "./job-description-errors";

const STATUS_OF: Record<JobDescriptionErrorCode, HttpStatus> = {
  job_description_not_found: HttpStatus.NOT_FOUND,
  job_description_too_long: HttpStatus.BAD_REQUEST,
  curation_not_completed: HttpStatus.UNPROCESSABLE_ENTITY,
};

const ERROR_NAME_OF: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.NOT_FOUND]: "Not Found",
  [HttpStatus.BAD_REQUEST]: "Bad Request",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "Unprocessable Entity",
};

export function apiErrorOf(error: JobDescriptionRefusedError): ApiError {
  const statusCode = STATUS_OF[error.code];

  return { statusCode, message: error.message, error: ERROR_NAME_OF[statusCode], code: error.code };
}

@Catch(JobDescriptionRefusedError)
export class JobDescriptionErrorFilter implements ExceptionFilter<JobDescriptionRefusedError> {
  catch(error: JobDescriptionRefusedError, host: ArgumentsHost): void {
    const body = apiErrorOf(error);

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
