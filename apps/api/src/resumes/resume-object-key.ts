import type { Id } from "@helpmegethired/shared";

// One prefix per Account, so a bucket listing never mixes Candidates.
export const resumeObjectKeyFor = (accountId: Id, uploadedResumeId: Id): string =>
  `resumes/${accountId}/${uploadedResumeId}.pdf`;
