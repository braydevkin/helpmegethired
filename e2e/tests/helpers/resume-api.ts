import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, type APIRequest, type APIRequestContext, type APIResponse } from "@playwright/test";
import { ResumeUploadReceiptSchema, UploadedResumeSchema, type UploadedResume } from "@helpmegethired/shared";

export const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3001";
export const resumeFixtures = join(import.meta.dirname, "../../../apps/api/test/fixtures/resumes");
export const corpusPdf = (slug: string) => readFileSync(join(resumeFixtures, "corpus", `${slug}.pdf`));

export const SETTLE_TIMEOUT_MS = 120_000;
export const POLL_INTERVAL_MS = 500;

const uploadOf = (bytes: Buffer, fileName: string) => ({ fileName, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });

export const apiAs = (request: APIRequest, token: string): Promise<APIRequestContext> =>
  request.newContext({ baseURL: apiUrl, extraHTTPHeaders: { authorization: `Bearer ${token}` } });

export async function parsed<Output>(response: APIResponse, schema: { parse: (input: unknown) => Output }): Promise<Output> {
  return schema.parse(await response.json());
}

// The three calls of the upload contract: reserve, PUT the bytes to storage, complete.
export async function upload(api: APIRequestContext, bytes: Buffer, fileName: string): Promise<UploadedResume> {
  const requested = await api.post("/resumes", { data: uploadOf(bytes, fileName) });

  expect(requested.status()).toBe(201);

  const receipt = await parsed(requested, ResumeUploadReceiptSchema);

  expect(receipt.upload).not.toBeNull();

  const put = await api.fetch(receipt.upload!.url, { method: receipt.upload!.method, headers: receipt.upload!.headers, data: bytes });

  expect(put.ok()).toBe(true);

  const completed = await api.post(`/resumes/${receipt.resume.id}/complete`);

  expect(completed.status()).toBe(202);

  return parsed(completed, UploadedResumeSchema);
}

// Polls the record the way the upload page does: with the last ETag, so an unchanged record
// answers 304 and costs nothing.
export async function settled(api: APIRequestContext, id: string): Promise<UploadedResume> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let etag: string | undefined;
  let last: UploadedResume | undefined;
  let notModified = 0;

  while (Date.now() < deadline) {
    const response = await api.get(`/resumes/${id}`, { headers: etag ? { "if-none-match": etag } : {} });

    if (response.status() === 304) {
      notModified += 1;
    } else {
      expect(response.status()).toBe(200);
      etag = response.headers().etag;
      last = await parsed(response, UploadedResumeSchema);

      if (last.status === "done" || last.status === "failed") {
        expect(etag).toBeDefined();

        return last;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`The Uploaded Resume ${id} did not settle in ${SETTLE_TIMEOUT_MS} ms; last status ${last?.status}, ${notModified} unchanged polls`);
}

export async function uploadCorpusResume(api: APIRequestContext, slug: string): Promise<UploadedResume> {
  const uploaded = await upload(api, corpusPdf(slug), `${slug}.pdf`);
  const done = await settled(api, uploaded.id);

  expect(done).toMatchObject({ status: "done", errorCode: null });

  return done;
}
