import { createHash } from "node:crypto";

import type { UploadedResume } from "@helpmegethired/shared";

// The tag changes with what the upload page renders: the status, the error, and the Progress.
export function etagOf(resume: UploadedResume): string {
  const digest = createHash("sha1")
    .update(JSON.stringify([resume.status, resume.errorCode, resume.progress]))
    .digest("hex");

  return `"${digest}"`;
}
