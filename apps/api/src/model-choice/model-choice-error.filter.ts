import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { ApiError } from "@helpmegethired/shared";
import type { Response } from "express";

import { ModelChoiceNotFoundError, ModelKeyRefusedError } from "./model-choice-errors";

type ModelChoiceError = ModelChoiceNotFoundError | ModelKeyRefusedError;

export function apiErrorOf(error: ModelChoiceError): ApiError {
  if (error instanceof ModelChoiceNotFoundError) {
    return { statusCode: HttpStatus.NOT_FOUND, message: "The Account has no Model Choice yet", error: "Not Found" };
  }

  return error.code === "provider_unavailable"
    ? { statusCode: HttpStatus.SERVICE_UNAVAILABLE, message: error.message, error: "Service Unavailable", code: error.code }
    : { statusCode: HttpStatus.UNPROCESSABLE_ENTITY, message: error.message, error: "Unprocessable Entity", code: error.code };
}

@Catch(ModelChoiceNotFoundError, ModelKeyRefusedError)
export class ModelChoiceErrorFilter implements ExceptionFilter<ModelChoiceError> {
  catch(error: ModelChoiceError, host: ArgumentsHost): void {
    const body = apiErrorOf(error);

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
