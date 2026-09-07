import { BadRequestException } from "@nestjs/common";
import { ApiErrorSchema, RESUME_MAX_SIZE_BYTES } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { ResumeUploadPipe } from "./resume-upload.pipe";

const upload = {
  fileName: "ada-lovelace.pdf",
  sizeBytes: 184_320,
  sha256: "9F86D081884C7D659A2FEAA0C55AD015A3BF4F1B2B0B822CD15D6C15B0F00A08",
};

const bodyOf = (input: unknown) => {
  try {
    new ResumeUploadPipe().transform(input);
  } catch (error) {
    return ApiErrorSchema.parse((error as BadRequestException).getResponse());
  }

  throw new Error("expected the pipe to reject");
};

describe("ResumeUploadPipe", () => {
  it("answers the parsed upload with the checksum canonicalised", () => {
    expect(new ResumeUploadPipe().transform(upload)).toEqual({ ...upload, sha256: upload.sha256.toLowerCase() });
  });

  it("answers not_pdf for a name without the .pdf extension", () => {
    expect(bodyOf({ ...upload, fileName: "ada-lovelace.docx" })).toMatchObject({ statusCode: 400, code: "not_pdf" });
  });

  it("answers too_large for a size over the limit", () => {
    expect(bodyOf({ ...upload, sizeBytes: RESUME_MAX_SIZE_BYTES + 1 })).toMatchObject({ statusCode: 400, code: "too_large" });
  });

  it("names the field without a code when only the checksum is wrong", () => {
    const body = bodyOf({ ...upload, sha256: "abc" });

    expect(body.code).toBeUndefined();
    expect(body.issues).toEqual([expect.objectContaining({ path: "sha256" })]);
  });
});
