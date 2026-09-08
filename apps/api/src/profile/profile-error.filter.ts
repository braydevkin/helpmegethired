import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { ApiError } from "@helpmegethired/shared";
import type { Response } from "express";

import { ProfileNotFoundError } from "./profile-errors";

@Catch(ProfileNotFoundError)
export class ProfileErrorFilter implements ExceptionFilter<ProfileNotFoundError> {
  catch(error: ProfileNotFoundError, host: ArgumentsHost): void {
    const body: ApiError = { statusCode: HttpStatus.NOT_FOUND, message: error.message, error: "Not Found" };

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
