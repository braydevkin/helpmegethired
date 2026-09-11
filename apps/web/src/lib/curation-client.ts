import { ApiErrorSchema, CurationActionErrorCodeSchema, CurationProgressStateSchema, type CurationActionErrorCode, type CurationProgressState } from "@helpmegethired/shared";

import { apiUrl } from "../config/api-url";

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

const codeOf = (body: unknown): CurationActionErrorCode | undefined => {
  const parsed = ApiErrorSchema.safeParse(body);
  const code = CurationActionErrorCodeSchema.safeParse(parsed.success ? parsed.data.code : undefined);

  return code.success ? code.data : undefined;
};

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

  // A body that is not JSON, as a proxy's error page, still ends in the client's own error.
  private async bodyOf(response: Response): Promise<unknown> {
    const body: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      throw new CurationRefusedError(codeOf(body), response.status);
    }

    return body;
  }
}

export const curationClient = new CurationClient(apiUrl);
