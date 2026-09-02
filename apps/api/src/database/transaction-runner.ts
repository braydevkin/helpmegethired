import { Inject, Injectable } from "@nestjs/common";

import { DATABASE, type Database } from "./database";

export type TransactionalWork<Result> = (transaction: Database) => Promise<Result>;

@Injectable()
export class TransactionRunner {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  run<Result>(work: TransactionalWork<Result>): Promise<Result> {
    return this.database.transaction().execute(work);
  }
}
