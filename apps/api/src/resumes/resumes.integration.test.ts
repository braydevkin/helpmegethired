import { createHash, randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  ApiErrorSchema,
  RESUME_MAX_SIZE_BYTES,
  ResumeUploadReceiptSchema,
  SESSION_LIFETIME_SECONDS,
  UploadedResumeListSchema,
  UploadedResumeSchema,
  type ResumeUploadReceipt,
} from "@helpmegethired/shared";
import type { Queue } from "bullmq";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";
import { AccountRepository } from "../auth/account.repository";
import { SessionRepository } from "../auth/session.repository";
import { hashSessionToken } from "../auth/session-token";
import { DATABASE, type Database } from "../database/database";
import { IngestionService } from "../ingestion/ingestion.service";
import { PROFILE_INGESTION_QUEUE, QUEUE_PREFIX, RESUME_EXTRACTION_QUEUE } from "../queue/queues";
import { EXTRACTION_JOB_NAME } from "./bullmq-resume-extraction.queue";

const pdfBytes = (seed: string) => Buffer.from(`%PDF-1.7\n% ${seed}\n%%EOF\n`);

describe("resume endpoints", () => {
  let app: INestApplication;
  let baseUrl: string;
  let accounts: AccountRepository;
  let sessions: SessionRepository;
  let extractionQueue: Queue;

  const request = (method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const openSession = async (): Promise<{ accountId: string; token: string }> => {
    const account = await accounts.create({ email: `${randomUUID()}@candidate.example` });
    const token = randomUUID();

    await sessions.create({
      accountId: account.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000),
    });

    return { accountId: account.id, token };
  };

  const uploadOf = (bytes: Buffer, fileName = "ada-lovelace.pdf") => ({
    fileName,
    sizeBytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });

  const requestUpload = async (token: string, bytes: Buffer): Promise<{ status: number; receipt: ResumeUploadReceipt }> => {
    const response = await request("POST", "/resumes", token, uploadOf(bytes));

    return { status: response.status, receipt: ResumeUploadReceiptSchema.parse(await response.json()) };
  };

  const putObject = async (receipt: ResumeUploadReceipt, bytes: Buffer): Promise<void> => {
    if (!receipt.upload) {
      throw new Error("expected an upload to perform");
    }

    const response = await fetch(receipt.upload.url, { method: receipt.upload.method, headers: receipt.upload.headers, body: bytes });

    expect(response.ok).toBe(true);
  };

  const uploaded = async (token: string, bytes: Buffer): Promise<ResumeUploadReceipt> => {
    const { receipt } = await requestUpload(token, bytes);

    await putObject(receipt, bytes);
    expect((await request("POST", `/resumes/${receipt.resume.id}/complete`, token)).status).toBe(202);

    return receipt;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    accounts = app.get(AccountRepository);
    sessions = app.get(SessionRepository);
    extractionQueue = app.get<Queue>(RESUME_EXTRACTION_QUEUE);
  });

  afterAll(async () => {
    await extractionQueue.obliterate({ force: true });
    await app.get<Queue>(PROFILE_INGESTION_QUEUE).obliterate({ force: true });
    await app.close();
  });

  describe("POST /resumes", () => {
    it("creates a pending record and answers the presigned upload with its expiry", async () => {
      const { accountId, token } = await openSession();
      const bytes = pdfBytes(randomUUID());

      const { status, receipt } = await requestUpload(token, bytes);

      expect(status).toBe(201);
      expect(receipt.resume).toMatchObject({ accountId, status: "pending", sizeBytes: bytes.length, errorCode: null, progress: null });
      expect(receipt.upload).toMatchObject({ method: "PUT", headers: expect.objectContaining({ "content-type": "application/pdf" }) });
      expect(receipt.upload?.url).toContain(`resumes/${accountId}/${receipt.resume.id}.pdf`);
      expect(Date.parse(receipt.upload?.expiresAt ?? "")).toBeGreaterThan(Date.now());
    });

    it("reuses a pending record for the same bytes and issues a fresh URL", async () => {
      const { token } = await openSession();
      const bytes = pdfBytes(randomUUID());
      const first = await requestUpload(token, bytes);

      const second = await requestUpload(token, bytes);

      expect(second.status).toBe(200);
      expect(second.receipt.resume.id).toBe(first.receipt.resume.id);
      expect(second.receipt.upload?.url).toBeDefined();
    });

    it("answers the existing record without an upload once the same bytes are uploaded, and adds no second job", async () => {
      const { token } = await openSession();
      const bytes = pdfBytes(randomUUID());
      const first = await uploaded(token, bytes);

      const again = await requestUpload(token, bytes);

      expect(again.status).toBe(200);
      expect(again.receipt).toEqual({ resume: { ...first.resume, status: "uploaded" }, upload: null });
      expect(await extractionQueue.getJob(first.resume.id)).toMatchObject({ name: EXTRACTION_JOB_NAME, attemptsMade: 0 });
    });

    it("keeps the same bytes apart per Account", async () => {
      const bytes = pdfBytes(randomUUID());
      const first = await requestUpload((await openSession()).token, bytes);

      const other = await requestUpload((await openSession()).token, bytes);

      expect(other.status).toBe(201);
      expect(other.receipt.resume.id).not.toBe(first.receipt.resume.id);
    });

    it("answers not_pdf and too_large from the shared error codes", async () => {
      const { token } = await openSession();
      const bytes = pdfBytes(randomUUID());

      const notPdf = await request("POST", "/resumes", token, uploadOf(bytes, "ada-lovelace.docx"));
      const tooLarge = await request("POST", "/resumes", token, { ...uploadOf(bytes), sizeBytes: RESUME_MAX_SIZE_BYTES + 1 });

      expect(notPdf.status).toBe(400);
      expect(ApiErrorSchema.parse(await notPdf.json()).code).toBe("not_pdf");
      expect(tooLarge.status).toBe(400);
      expect(ApiErrorSchema.parse(await tooLarge.json()).code).toBe("too_large");
    });

    it("answers 401 without a Session", async () => {
      expect((await request("POST", "/resumes", undefined, uploadOf(pdfBytes("x")))).status).toBe(401);
    });
  });

  describe("POST /resumes/:id/complete", () => {
    it("answers 409 upload_incomplete and leaves the record pending while the object is missing", async () => {
      const { token } = await openSession();
      const { receipt } = await requestUpload(token, pdfBytes(randomUUID()));

      const response = await request("POST", `/resumes/${receipt.resume.id}/complete`, token);

      expect(response.status).toBe(409);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe("upload_incomplete");
      expect(UploadedResumeSchema.parse(await (await request("GET", `/resumes/${receipt.resume.id}`, token)).json()).status).toBe("pending");
    });

    it("marks the record uploaded and queues one extraction job identified by the record", async () => {
      const { token } = await openSession();
      const bytes = pdfBytes(randomUUID());
      const { receipt } = await requestUpload(token, bytes);
      await putObject(receipt, bytes);

      const response = await request("POST", `/resumes/${receipt.resume.id}/complete`, token);

      expect(response.status).toBe(202);
      expect(UploadedResumeSchema.parse(await response.json())).toMatchObject({ id: receipt.resume.id, status: "uploaded" });
      expect(await extractionQueue.getJob(receipt.resume.id)).toMatchObject({
        name: EXTRACTION_JOB_NAME,
        data: { uploadedResumeId: receipt.resume.id, maxAttempts: 3 },
      });
    });

    it("is idempotent for a record that is no longer pending", async () => {
      const { token } = await openSession();
      const receipt = await uploaded(token, pdfBytes(randomUUID()));

      const response = await request("POST", `/resumes/${receipt.resume.id}/complete`, token);

      expect(response.status).toBe(202);
      expect(UploadedResumeSchema.parse(await response.json()).status).toBe("uploaded");
    });

    it("answers 409 ingestion_active while another upload of the Account is in flight", async () => {
      const { token } = await openSession();
      await uploaded(token, pdfBytes(randomUUID()));
      const bytes = pdfBytes(randomUUID());
      const { receipt } = await requestUpload(token, bytes);
      await putObject(receipt, bytes);

      const response = await request("POST", `/resumes/${receipt.resume.id}/complete`, token);

      expect(response.status).toBe(409);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe("ingestion_active");
      expect(UploadedResumeSchema.parse(await (await request("GET", `/resumes/${receipt.resume.id}`, token)).json()).status).toBe("pending");
    });

    it("answers 409 ingestion_active while an Ingestion of the Account is active", async () => {
      const { accountId, token } = await openSession();
      const bytes = pdfBytes(randomUUID());
      const { receipt } = await requestUpload(token, bytes);
      await putObject(receipt, bytes);
      await app.get(IngestionService).start({ accountId, source: "upload", segments: [{ kind: "experience", input: { text: "first" } }] });

      const response = await request("POST", `/resumes/${receipt.resume.id}/complete`, token);

      expect(response.status).toBe(409);
      expect(ApiErrorSchema.parse(await response.json()).code).toBe("ingestion_active");
    });

    it("accepts an upload while a Curation of the Account is running", async () => {
      const { accountId, token } = await openSession();
      const database = app.get<Database>(DATABASE);
      const { id: ingestionId } = await database
        .insertInto("ingestions")
        .values({ account_id: accountId, source: "upload", status: "completed", max_attempts: 3, completed_at: new Date() })
        .returning("id")
        .executeTakeFirstOrThrow();
      await database
        .insertInto("curations")
        .values({ account_id: accountId, source_ingestion_id: ingestionId, status: "running", max_attempts: 3, prompt_version: "curation/1", model_id: "claude-sonnet-5" })
        .execute();

      const receipt = await uploaded(token, pdfBytes(randomUUID()));

      expect(UploadedResumeSchema.parse(await (await request("GET", `/resumes/${receipt.resume.id}`, token)).json()).status).toBe("uploaded");
    });

    it("answers 404 for a record of another Account", async () => {
      const { token } = await openSession();
      const { receipt } = await requestUpload(token, pdfBytes(randomUUID()));

      expect((await request("POST", `/resumes/${receipt.resume.id}/complete`, (await openSession()).token)).status).toBe(404);
    });
  });

  describe("GET /resumes/:id", () => {
    it("answers the record with an ETag, then 304 until the status changes", async () => {
      const { token } = await openSession();
      const bytes = pdfBytes(randomUUID());
      const { receipt } = await requestUpload(token, bytes);

      const first = await request("GET", `/resumes/${receipt.resume.id}`, token);
      const etag = first.headers.get("etag") ?? "";

      expect(first.status).toBe(200);
      expect(UploadedResumeSchema.parse(await first.json())).toMatchObject({ id: receipt.resume.id, status: "pending" });
      expect(etag).toMatch(/^"[0-9a-f]+"$/);

      const unchanged = await request("GET", `/resumes/${receipt.resume.id}`, token, undefined, { "if-none-match": etag });

      expect(unchanged.status).toBe(304);
      expect(await unchanged.text()).toBe("");

      await putObject(receipt, bytes);
      await request("POST", `/resumes/${receipt.resume.id}/complete`, token);

      const changed = await request("GET", `/resumes/${receipt.resume.id}`, token, undefined, { "if-none-match": etag });

      expect(changed.status).toBe(200);
      expect(changed.headers.get("etag")).not.toBe(etag);
      expect(UploadedResumeSchema.parse(await changed.json()).status).toBe("uploaded");
    });

    it("answers 404 for a record of another Account and for an unknown id", async () => {
      const { token } = await openSession();
      const { receipt } = await requestUpload(token, pdfBytes(randomUUID()));

      expect((await request("GET", `/resumes/${receipt.resume.id}`, (await openSession()).token)).status).toBe(404);
      expect((await request("GET", `/resumes/${randomUUID()}`, token)).status).toBe(404);
    });
  });

  describe("GET /resumes", () => {
    it("lists the Account's records newest first, filtered by status on request", async () => {
      const { token } = await openSession();
      const first = await uploaded(token, pdfBytes(randomUUID()));
      const second = await requestUpload(token, pdfBytes(randomUUID()));

      const all = UploadedResumeListSchema.parse(await (await request("GET", "/resumes", token)).json());
      const pending = UploadedResumeListSchema.parse(await (await request("GET", "/resumes?status=pending", token)).json());

      expect(all.map((resume) => resume.id)).toEqual([second.receipt.resume.id, first.resume.id]);
      expect(pending.map((resume) => resume.id)).toEqual([second.receipt.resume.id]);
      expect((await request("GET", "/resumes?status=archived", token)).status).toBe(400);
    });

    it("never lists another Account's records", async () => {
      await requestUpload((await openSession()).token, pdfBytes(randomUUID()));

      expect(await (await request("GET", "/resumes", (await openSession()).token)).json()).toEqual([]);
    });
  });
});
