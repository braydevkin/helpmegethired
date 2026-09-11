import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { ApiError } from "@helpmegethired/shared";
import type { Response } from "express";

import { ProfileConfirmedError, ProfileEntryNotFoundError, ProfileNotFoundError } from "./profile-errors";

type ProfileError = ProfileNotFoundError | ProfileEntryNotFoundError | ProfileConfirmedError;

const NOT_FOUND = { statusCode: HttpStatus.NOT_FOUND, error: "Not Found" } as const;
const CONFLICT = { statusCode: HttpStatus.CONFLICT, error: "Conflict" } as const;

// A Profile or an entry of it that this Account does not have reads as absent; a Profile that
// no longer takes corrections is a conflict with what the Candidate already decided.
const answerTo = (error: ProfileError) => (error instanceof ProfileConfirmedError ? CONFLICT : NOT_FOUND);

@Catch(ProfileNotFoundError, ProfileEntryNotFoundError, ProfileConfirmedError)
export class ProfileErrorFilter implements ExceptionFilter<ProfileError> {
  catch(error: ProfileError, host: ArgumentsHost): void {
    const body: ApiError = { ...answerTo(error), message: error.message };

    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
