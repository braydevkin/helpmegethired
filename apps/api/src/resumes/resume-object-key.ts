import type { Id } from "@helpmegethired/shared";

export const RESUME_OBJECT_PREFIX = "resumes/";

// One prefix per Account, so a bucket listing never mixes Candidates.
export const resumeObjectKeyFor = (accountId: Id, uploadedResumeId: Id): string =>
  `${RESUME_OBJECT_PREFIX}${accountId}/${uploadedResumeId}.pdf`;
