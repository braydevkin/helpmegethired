import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";
import type { ApiError } from "@helpmegethired/shared";
import type { Response } from "express";

import { StatementNotFoundError } from "./statement-errors";

// The same answer for a Statement of another Account as for one that does not exist, so the
// answer never tells whether an id belongs to someone.
const NOT_FOUND: ApiError = { statusCode: HttpStatus.NOT_FOUND, message: "The Account has no such Statement", error: "Not Found" };

@Catch(StatementNotFoundError)
export class StatementErrorFilter implements ExceptionFilter<StatementNotFoundError> {
  catch(_error: StatementNotFoundError, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(NOT_FOUND.statusCode).json(NOT_FOUND);
  }
}
