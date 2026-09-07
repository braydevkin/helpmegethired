import { createHash, randomUUID } from "node:crypto";

import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EnvironmentModule } from "../config/environment.module";
import { ObjectStorage, type PresignedUpload } from "./object-storage";
import { StorageModule } from "./storage.module";

const PDF_CONTENT_TYPE = "application/pdf";
const bytes = Buffer.from("%PDF-1.7\n% a fixture the storage test uploads and reads back\n");
const sha256 = createHash("sha256").update(bytes).digest("hex");

const readAll = async (stream: AsyncIterable<Uint8Array>): Promise<Buffer> => {
  const chunks: Uint8Array[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

describe("object storage through S3", () => {
  let context: INestApplicationContext;
  let storage: ObjectStorage;
  let key: string;
  let presigned: PresignedUpload;

  const put = (body: Buffer, headers: Record<string, string> = presigned.headers) =>
    fetch(presigned.url, { method: "PUT", headers, body });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [EnvironmentModule, StorageModule] }).compile();

    context = await moduleRef.init();
    storage = context.get(ObjectStorage);
    key = `resumes/${randomUUID()}/${randomUUID()}.pdf`;
    presigned = await storage.presignPut(key, bytes.length, sha256, PDF_CONTENT_TYPE);
  });

  afterAll(async () => {
    await storage.delete(key);
    await context.close();
  });

  it("answers absent for a key that was never uploaded", async () => {
    expect(await storage.head(key)).toBeUndefined();
  });

  it("signs a URL on the public endpoint that expires after the configured seconds", () => {
    expect(presigned.url.startsWith(process.env.S3_PUBLIC_ENDPOINT ?? "")).toBe(true);
    expect(presigned.url).toContain(`X-Amz-Expires=${process.env.PRESIGN_EXPIRES_SECONDS ?? "300"}`);
    expect(presigned.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("refuses a PUT whose size differs from the signed one", async () => {
    const response = await put(bytes.subarray(0, bytes.length - 1));

    expect(response.ok).toBe(false);
    expect(await storage.head(key)).toBeUndefined();
  });

  it("refuses a PUT whose checksum header differs from the signed one", async () => {
    const other = createHash("sha256").update("another file").digest("base64");
    const response = await put(bytes, { ...presigned.headers, "x-amz-checksum-sha256": other });

    expect(response.ok).toBe(false);
    expect(await storage.head(key)).toBeUndefined();
  });

  it("refuses a PUT whose bytes do not match the signed checksum", async () => {
    const sameSize = Buffer.from(bytes.toString().toUpperCase());
    const response = await put(sameSize);

    expect(response.ok).toBe(false);
    expect(await storage.head(key)).toBeUndefined();
  });

  it("accepts the PUT that matches the signed size, checksum, and content type", async () => {
    const response = await put(bytes);

    expect(response.ok).toBe(true);
    expect(await storage.head(key)).toEqual({ size: bytes.length });
  });

  it("streams the stored bytes back through the internal endpoint", async () => {
    expect(await readAll(await storage.getStream(key))).toEqual(bytes);
  });

  it("deletes the object so it heads as absent", async () => {
    await storage.delete(key);

    expect(await storage.head(key)).toBeUndefined();
  });
});
