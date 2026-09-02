import type { Account } from "@helpmegethired/shared";
import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  account: Account;
  sessionToken: string;
}
