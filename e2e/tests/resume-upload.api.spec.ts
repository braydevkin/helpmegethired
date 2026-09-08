import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { ProfileSchema, ResumeUploadReceiptSchema, UploadedResumeSchema, type UploadedResume } from "@helpmegethired/shared";

import { signUpAndReadSessionToken } from "./helpers/sign-in.js";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3001";
const fixtures = join(import.meta.dirname, "../../apps/api/test/fixtures/resumes");
const corpusPdf = (slug: string) => readFileSync(join(fixtures, "corpus", `${slug}.pdf`));
const hostilePdf = (name: string) => readFileSync(join(fixtures, "hostile", `${name}.pdf`));

interface ExpectedDraft {
  draft: { experiences: { role: { value: string }; company: { value: string } | null }[]; skills: { name: string }[] };
}

const expectedDraft = (slug: string): ExpectedDraft => JSON.parse(readFileSync(join(fixtures, "corpus/expected", `${slug}.json`), "utf8")) as ExpectedDraft;

const SETTLE_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;

const uploadOf = (bytes: Buffer, fileName: string) => ({ fileName, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });

async function parsed<Output>(response: APIResponse, schema: { parse: (input: unknown) => Output }): Promise<Output> {
  return schema.parse(await response.json());
}

// The three calls of the upload contract: reserve, PUT the bytes to storage, complete.
async function upload(api: APIRequestContext, bytes: Buffer, fileName: string): Promise<UploadedResume> {
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
async function settled(api: APIRequestContext, id: string): Promise<UploadedResume> {
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

test.describe("the upload API, from a PDF to a confirmed Profile", () => {
  test("takes a synthetic resume to a confirmed Profile and a hostile file to failed with its code", async ({ page, playwright }) => {
    test.setTimeout(SETTLE_TIMEOUT_MS * 3);

    const { token } = await signUpAndReadSessionToken(page);
    const api = await playwright.request.newContext({ baseURL: apiUrl, extraHTTPHeaders: { authorization: `Bearer ${token}` } });

    await test.step("a new Account has an empty Profile", async () => {
      const profile = await parsed(await api.get("/profile"), ProfileSchema);

      expect(profile).toMatchObject({ source: null, experiences: [], reviewFlags: [] });
    });

    await test.step("the synthetic resume ends done with a Profile that matches its expected output", async () => {
      const slug = "ada-single-column-en";
      const uploaded = await upload(api, corpusPdf(slug), `${slug}.pdf`);

      expect(uploaded.status).toBe("uploaded");

      const done = await settled(api, uploaded.id);

      expect(done).toMatchObject({ status: "done", errorCode: null, progress: { percentage: 100 } });

      const profile = await parsed(await api.get("/profile"), ProfileSchema);
      const expected = expectedDraft(slug);

      expect(profile.source).toMatchObject({ kind: "upload", uploadedResumeId: uploaded.id, fileName: `${slug}.pdf` });
      expect(profile.experiences.map((experience) => [experience.role, experience.company])).toEqual(
        expected.draft.experiences.map((experience) => [experience.role.value, experience.company?.value ?? null]),
      );
      expect(profile.skills.map((skill) => skill.name).sort()).toEqual(expected.draft.skills.map((skill) => skill.name).sort());
      expect(profile.yearsOfExperience).toBeGreaterThan(0);
    });

    await test.step("confirming clears the review flags and is idempotent", async () => {
      const confirmed = await parsed(await api.post("/profile/confirm"), ProfileSchema);
      const again = await parsed(await api.post("/profile/confirm"), ProfileSchema);

      expect(confirmed.reviewFlags).toEqual([]);
      expect(confirmed.confirmedAt).not.toBeNull();
      expect(again.confirmedAt).toBe(confirmed.confirmedAt);
    });

    await test.step("a file that is not a PDF ends failed with not_pdf and leaves the Profile", async () => {
      const uploaded = await upload(api, hostilePdf("wrong-magic-bytes"), "wrong-magic-bytes.pdf");
      const failed = await settled(api, uploaded.id);

      expect(failed).toMatchObject({ status: "failed", errorCode: "not_pdf", progress: null });

      const profile = await parsed(await api.get("/profile"), ProfileSchema);

      expect(profile.source?.fileName).toBe("ada-single-column-en.pdf");
    });

    await api.dispose();
  });

  test("refuses every route without the Session, and the docs answer without one", async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: apiUrl });

    for (const path of ["/profile", "/resumes", "/auth/account"]) {
      expect((await api.get(path)).status()).toBe(401);
    }

    expect((await api.get("/docs/openapi.json")).status()).toBe(200);

    await api.dispose();
  });
});
