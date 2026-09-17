import { CuratedStatementSchema, CurationStatementsSchema, type CuratedStatement, type CurationStatements, type StatementReviewState } from "@helpmegethired/shared";

import { apiUrl } from "../config/api-url";
import { jsonBodyOf } from "./api-response";

// A Statement of another Account answers 404 exactly like one that does not exist, so the
// status is all a refusal carries.
export class StatementRefusedError extends Error {
  constructor(readonly status: number) {
    super(`The API refused the Statement request with ${status}`);
    this.name = "StatementRefusedError";
  }
}

export class StatementClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async list(token: string): Promise<CurationStatements> {
    const response = await this.request("/profile/curation/statements", token, { method: "GET" });

    return CurationStatementsSchema.parse(await this.bodyOf(response));
  }

  async review(token: string, id: string, state: StatementReviewState): Promise<CuratedStatement> {
    const response = await this.request(`/profile/curation/statements/${encodeURIComponent(id)}/review`, token, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state }),
    });

    return CuratedStatementSchema.parse(await this.bodyOf(response));
  }

  private request(path: string, token: string, init: { method: string; headers?: Record<string, string>; body?: string }): Promise<Response> {
    return this.fetchImplementation(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: { authorization: `Bearer ${token}`, ...init.headers },
      body: init.body,
      cache: "no-store",
    });
  }

  private bodyOf(response: Response): Promise<unknown> {
    return jsonBodyOf(response, () => new StatementRefusedError(response.status));
  }
}

export const statementClient = new StatementClient(apiUrl);
