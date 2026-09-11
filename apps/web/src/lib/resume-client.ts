import {
  ResumeUploadErrorCodeSchema,
  ResumeUploadReceiptSchema,
  UploadedResumeListSchema,
  UploadedResumeSchema,
  type ResumeUpload,
  type ResumeUploadErrorCode,
  type ResumeUploadReceipt,
  type UploadedResume,
} from "@helpmegethired/shared";

import { apiUrl } from "../config/api-url";
import { apiErrorCodeOf, jsonBodyOf } from "./api-response";

// A refusal the API explains with one of the shared codes, such as another Ingestion in flight.
export class ResumeRefusedError extends Error {
  constructor(
    readonly code: ResumeUploadErrorCode | undefined,
    readonly status: number,
  ) {
    super(`The API refused the request with ${status}${code ? ` (${code})` : ""}`);
    this.name = "ResumeRefusedError";
  }
}

export type ResumeRead = { changed: false } | { changed: true; resume: UploadedResume; etag: string | undefined };

export class ResumeClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async requestUpload(token: string, upload: ResumeUpload): Promise<ResumeUploadReceipt> {
    const response = await this.request("/resumes", token, { method: "POST", body: upload });

    return ResumeUploadReceiptSchema.parse(await this.bodyOf(response));
  }

  async complete(token: string, id: string): Promise<UploadedResume> {
    const response = await this.request(`/resumes/${id}/complete`, token, { method: "POST" });

    return UploadedResumeSchema.parse(await this.bodyOf(response));
  }

  // Sends the last ETag back so an unchanged record costs a 304 and no body.
  async read(token: string, id: string, etag: string | undefined): Promise<ResumeRead> {
    const response = await this.request(`/resumes/${id}`, token, { headers: etag ? { "if-none-match": etag } : {} });

    if (response.status === 304) {
      return { changed: false };
    }

    return { changed: true, resume: UploadedResumeSchema.parse(await this.bodyOf(response)), etag: response.headers.get("etag") ?? undefined };
  }

  async list(token: string): Promise<UploadedResume[]> {
    const response = await this.request("/resumes", token, {});

    return UploadedResumeListSchema.parse(await this.bodyOf(response));
  }

  private request(path: string, token: string, init: { method?: string; body?: unknown; headers?: Record<string, string> }): Promise<Response> {
    return this.fetchImplementation(`${this.baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  }

  private bodyOf(response: Response): Promise<unknown> {
    return jsonBodyOf(response, (body) => new ResumeRefusedError(apiErrorCodeOf(body, ResumeUploadErrorCodeSchema), response.status));
  }
}

export const resumeClient = new ResumeClient(apiUrl);
