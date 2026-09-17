import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { ApiError } from "@helpmegethired/shared";
import type { Response } from "express";

import { ProfileRecognitionRefusedError } from "./profile-recognition-errors";

// A Profile with no text to read is absent; every other refusal is work already in flight or a
// key the Candidate has not stored, which clears once they act.
export function apiErrorOf(error: ProfileRecognitionRefusedError): ApiError {
  return error.code === "resume_text_missing"
    ? { statusCode: HttpStatus.NOT_FOUND, message: error.message, error: "Not Found", code: error.code }
    : { statusCode: HttpStatus.CONFLICT, message: error.message, error: "Conflict", code: error.code };
}

@Catch(ProfileRecognitionRefusedError)
export class ProfileRecognitionErrorFilter implements ExceptionFilter<ProfileRecognitionRefusedError> {
  catch(error: ProfileRecognitionRefusedError, host: ArgumentsHost): void {
    const body = apiErrorOf(error);

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
