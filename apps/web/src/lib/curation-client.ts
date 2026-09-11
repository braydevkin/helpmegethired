import { CurationActionErrorCodeSchema, CurationProgressStateSchema, type CurationActionErrorCode, type CurationProgressState } from "@helpmegethired/shared";

import { apiUrl } from "../config/api-url";
import { apiErrorCodeOf, jsonBodyOf } from "./api-response";

export class CurationRefusedError extends Error {
  constructor(
    readonly code: CurationActionErrorCode | undefined,
    readonly status: number,
  ) {
    super(`The API refused the request with ${status}${code ? ` (${code})` : ""}`);
    this.name = "CurationRefusedError";
  }
}

export type CurationRead = { changed: false } | { changed: true; state: CurationProgressState; etag: string | undefined };

export class CurationClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  // Sends the last ETag back so an unchanged Curation costs a 304 and no body.
  async read(token: string, etag: string | undefined): Promise<CurationRead> {
    const response = await this.fetchImplementation(`${this.baseUrl}/profile/curation`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}`, ...(etag ? { "if-none-match": etag } : {}) },
      cache: "no-store",
    });

    if (response.status === 304) {
      return { changed: false };
    }

    return { changed: true, state: CurationProgressStateSchema.parse(await this.bodyOf(response)), etag: response.headers.get("etag") ?? undefined };
  }

  cancel(token: string): Promise<CurationProgressState> {
    return this.act("cancel", token);
  }

  retry(token: string): Promise<CurationProgressState> {
    return this.act("retry", token);
  }

  rerun(token: string): Promise<CurationProgressState> {
    return this.act("rerun", token);
  }

  private async act(action: "cancel" | "retry" | "rerun", token: string): Promise<CurationProgressState> {
    const response = await this.fetchImplementation(`${this.baseUrl}/profile/curation/${action}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    return CurationProgressStateSchema.parse(await this.bodyOf(response));
  }

  private bodyOf(response: Response): Promise<unknown> {
    return jsonBodyOf(response, (body) => new CurationRefusedError(apiErrorCodeOf(body, CurationActionErrorCodeSchema), response.status));
  }
}

export const curationClient = new CurationClient(apiUrl);
