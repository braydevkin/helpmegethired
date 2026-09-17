import type { Id } from "@helpmegethired/shared";

export class StatementNotFoundError extends Error {
  constructor(statementId: Id) {
    super(`The Account has no Statement ${statementId}`);
    this.name = "StatementNotFoundError";
  }
}
