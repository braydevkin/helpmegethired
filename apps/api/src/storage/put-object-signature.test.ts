import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PUT_SIGNED_HEADERS, putObjectInput, sha256HexToBase64, uploadHeaders } from "./put-object-signature";

const bytes = Buffer.from("%PDF-1.7 fixture");
const sha256 = createHash("sha256").update(bytes).digest("hex");

describe("sha256HexToBase64", () => {
  it("encodes the digest the way the checksum header expects it", () => {
    expect(sha256HexToBase64(sha256)).toBe(createHash("sha256").update(bytes).digest("base64"));
  });
});

describe("putObjectInput", () => {
  it("fixes the bucket, the key, the content type, the size, and the checksum", () => {
    expect(putObjectInput("resumes", "resumes/account/upload.pdf", bytes.length, sha256, "application/pdf")).toEqual({
      Bucket: "resumes",
      Key: "resumes/account/upload.pdf",
      ContentType: "application/pdf",
      ContentLength: bytes.length,
      ChecksumSHA256: sha256HexToBase64(sha256),
    });
  });
});

describe("uploadHeaders", () => {
  it("names the headers the browser must send with the signed values", () => {
    expect(uploadHeaders(sha256, "application/pdf")).toEqual({
      "content-type": "application/pdf",
      "x-amz-checksum-sha256": sha256HexToBase64(sha256),
    });
  });

  it("only names headers that are part of the signature", () => {
    for (const header of Object.keys(uploadHeaders(sha256, "application/pdf"))) {
      expect(PUT_SIGNED_HEADERS.has(header)).toBe(true);
    }
  });
});
