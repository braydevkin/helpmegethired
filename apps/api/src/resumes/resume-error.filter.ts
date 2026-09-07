import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { ApiError, ResumeUploadErrorCode } from "@helpmegethired/shared";
import type { Response } from "express";

import { IngestionAlreadyActiveError } from "../ingestion/ingestion-errors";
import { UploadIncompleteError, UploadInFlightError, UploadedResumeNotFoundError } from "./resume-errors";

type ResumeError = UploadedResumeNotFoundError | UploadIncompleteError | UploadInFlightError | IngestionAlreadyActiveError;

const conflict = (code: ResumeUploadErrorCode, message: string): ApiError => ({
  statusCode: HttpStatus.CONFLICT,
  message,
  error: "Conflict",
  code,
});

export function apiErrorOf(error: ResumeError): ApiError {
  if (error instanceof UploadedResumeNotFoundError) {
    return { statusCode: HttpStatus.NOT_FOUND, message: error.message, error: "Not Found" };
  }

  if (error instanceof UploadIncompleteError) {
    return conflict("upload_incomplete", error.message);
  }

  return conflict("ingestion_active", error.message);
}

@Catch(UploadedResumeNotFoundError, UploadIncompleteError, UploadInFlightError, IngestionAlreadyActiveError)
export class ResumeErrorFilter implements ExceptionFilter<ResumeError> {
  catch(error: ResumeError, host: ArgumentsHost): void {
    const body = apiErrorOf(error);

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
