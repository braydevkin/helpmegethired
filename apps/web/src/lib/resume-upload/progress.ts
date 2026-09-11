import type { IngestionProgress, ResumeUploadErrorCode, UploadedResume } from "@helpmegethired/shared";

export type StageState = "done" | "active" | "waiting" | "failed";

export interface PipelineStage {
  title: string;
  detail: string;
  state: StageState;
}

export interface ProfileDataRow {
  label: string;
  value: string | undefined;
}

// What the page knows about the upload: the bytes on their way, or the record as the API
// last answered it.
export type UploadView = { phase: "uploading"; bytesSent: number; bytesTotal: number } | { phase: "tracked"; resume: UploadedResume };

const UPLOAD_SHARE = 25;
const PROCESSING_START = 30;
const BUILDING_SHARE = 100 - PROCESSING_START;

const STAGES = [
  { title: "Uploading to secure storage", detail: "Direct, presigned transfer to object storage." },
  { title: "Queued for processing", detail: "Job registered and picked up by a worker." },
  { title: "Reading your résumé", detail: "Parsing sections, dates and contact details." },
  { title: "Building your profile", detail: "Mapping experience, skills and languages." },
  { title: "Profile saved", detail: "Everything stored and ready to review." },
] as const;

// Which of the five stages is running for a record, counted from zero.
function activeStageOf(view: UploadView): number {
  if (view.phase === "uploading") {
    return 0;
  }

  switch (view.resume.status) {
    case "pending":
      return 0;
    case "uploaded":
      return 1;
    case "processing":
    case "failed":
      return view.resume.progress ? 3 : 2;
    case "done":
    case "expired":
      return 4;
  }
}

const buildingPercentage = (progress: IngestionProgress): number => PROCESSING_START + Math.floor((BUILDING_SHARE * progress.percentage) / 100);

// One number from two records: the bytes fill 0 to 25, `uploaded` is 25, `processing`
// before the Ingestion exists is 30, and the Ingestion Progress maps onto 30 to 100.
export function percentageOf(view: UploadView): number {
  if (view.phase === "uploading") {
    return view.bytesTotal === 0 ? 0 : Math.floor((UPLOAD_SHARE * view.bytesSent) / view.bytesTotal);
  }

  const { resume } = view;

  switch (resume.status) {
    case "pending":
      return 0;
    case "uploaded":
      return UPLOAD_SHARE;
    case "processing":
    case "failed":
      return resume.progress ? buildingPercentage(resume.progress) : PROCESSING_START;
    case "done":
      return 100;
    case "expired":
      return 0;
  }
}

export function stagesOf(view: UploadView): PipelineStage[] {
  const active = activeStageOf(view);
  const done = view.phase === "tracked" && view.resume.status === "done";
  const failed = view.phase === "tracked" && view.resume.status === "failed";

  return STAGES.map((stage, index) => {
    const state: StageState = done || index < active ? "done" : index === active ? (failed ? "failed" : "active") : "waiting";

    return { title: stage.title, detail: state === "active" || state === "failed" ? stage.detail : state === "done" ? "Done" : "Waiting", state };
  });
}

const HEADER_ROWS = ["Headline", "Summary", "GitHub profile", "LinkedIn profile"] as const;

interface RowRule {
  label: string;
  kind: string;
  value: (count: number) => string;
}

const found = () => "Found";
const counted = (noun: string) => (count: number) => `${count} ${noun}`;

const ROW_RULES: readonly RowRule[] = [
  ...HEADER_ROWS.map((label) => ({ label, kind: "header", value: found })),
  { label: "Years of experience", kind: "experience", value: found },
  { label: "Experience", kind: "experience", value: (count) => `${count} ${count === 1 ? "role" : "roles"}` },
  { label: "Education", kind: "education", value: found },
  { label: "Skills", kind: "skills", value: found },
  { label: "Projects", kind: "project", value: counted("found") },
  { label: "Certifications", kind: "certifications", value: found },
  { label: "Languages", kind: "languages", value: found },
];

// One row per Profile part, its value shown once the Segment of that kind is saved.
export function profileDataRowsOf(view: UploadView): ProfileDataRow[] {
  const kinds = view.phase === "tracked" ? (view.resume.progress?.segments.savedKinds ?? []) : [];
  const done = view.phase === "tracked" && view.resume.status === "done";

  return ROW_RULES.map((rule) => {
    const count = kinds.filter((kind) => kind === rule.kind).length;

    return { label: rule.label, value: count > 0 || done ? rule.value(Math.max(count, 1)) : undefined };
  });
}

export const foundCountOf = (rows: readonly ProfileDataRow[]): { found: number; total: number } => ({
  found: rows.filter((row) => row.value !== undefined).length,
  total: rows.length,
});

const FAILURE_LEADS: Record<ResumeUploadErrorCode, string> = {
  scanned_pdf: "This PDF is a scan or an image. We need a text-based PDF: export it again from your editor and try once more.",
  encrypted_pdf: "This PDF is password-protected. Remove the password and upload it again.",
  corrupt_pdf: "This file is damaged and cannot be opened. Export it again and try once more.",
  too_large: "That PDF is over 5 MB. Compress it or remove heavy images.",
  too_many_pages: "This PDF has more than 20 pages. A résumé of up to 20 pages works best.",
  not_pdf: "That file is not a PDF. Export your résumé as PDF and try again.",
  upload_incomplete: "The upload didn't finish. Check your connection and try again.",
  extraction_failed: "We couldn't read this PDF after several tries. Export it again, or try a different version.",
  profile_build_failed: "We read your PDF but couldn't build your profile. Upload it again, or try a different version.",
  ingestion_active: "Your previous résumé is still being read. Wait for it to finish, then try again.",
};

export const failureLeadOf = (code: ResumeUploadErrorCode | null): string => FAILURE_LEADS[code ?? "extraction_failed"];

export const INGESTION_ACTIVE_MESSAGE = FAILURE_LEADS.ingestion_active;
