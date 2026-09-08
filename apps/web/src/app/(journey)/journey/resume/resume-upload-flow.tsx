"use client";

import type { UploadedResume } from "@helpmegethired/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "../../../../components/atoms/button/button";
import { ScreenHeading } from "../../../../components/molecules/screen-heading/screen-heading";
import { IngestionProgress } from "../../../../components/organisms/ingestion-progress/ingestion-progress";
import { UploadDropArea } from "../../../../components/organisms/upload-drop-area/upload-drop-area";
import { formatSize } from "../../../../lib/resume-upload/format";
import {
  failureLeadOf,
  foundCountOf,
  percentageOf,
  pollDelayMs,
  profileDataRowsOf,
  stagesOf,
  type UploadView,
} from "../../../../lib/resume-upload/progress";
import { RESUME_MAX_SIZE_MB, rejectionOf } from "../../../../lib/resume-upload/rejection";
import { sha256Of } from "../../../../lib/resume-upload/sha256";
import { completeResumeAction, createResumeAction, readResumeAction } from "./actions";

export interface ResumeUploadFlowProps {
  initialResume: UploadedResume | null;
  profileHref: string;
}

type FlowState =
  | { phase: "idle"; message?: string }
  | { phase: "uploading"; file: File; bytesSent: number; bytesTotal: number; request?: XMLHttpRequest }
  | { phase: "tracked"; resume: UploadedResume; etag?: string; attempt: number };

const DROP_HINT = `PDF only · up to ${RESUME_MAX_SIZE_MB} MB · one file`;
const TRACKED_STATUSES = new Set<UploadedResume["status"]>(["uploaded", "processing"]);
const PUT_FAILED_MESSAGE = "The upload didn't finish. Check your connection and try again.";

const tracked = (resume: UploadedResume, etag?: string): FlowState => ({ phase: "tracked", resume, etag, attempt: 0 });

const viewOf = (state: Exclude<FlowState, { phase: "idle" }>): UploadView =>
  state.phase === "uploading" ? { phase: "uploading", bytesSent: state.bytesSent, bytesTotal: state.bytesTotal } : { phase: "tracked", resume: state.resume };

// The bytes go straight from the browser to the presigned URL; the byte count drives the
// first stage, and an aborted or failed transfer leaves the record to expire.
function putBytes(url: string, headers: Record<string, string>, file: File, onProgress: (sent: number) => void): { request: XMLHttpRequest; done: Promise<boolean> } {
  const request = new XMLHttpRequest();
  const done = new Promise<boolean>((resolve) => {
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onload = () => resolve(request.status >= 200 && request.status < 300);
    request.onerror = () => resolve(false);
    request.onabort = () => resolve(false);
  });

  request.open("PUT", url);

  for (const [name, value] of Object.entries(headers)) {
    request.setRequestHeader(name, value);
  }

  request.send(file);

  return { request, done };
}

function useResumeUploadFlow(initialResume: UploadedResume | null) {
  const [state, setState] = useState<FlowState>(initialResume ? tracked(initialResume) : { phase: "idle" });
  const generation = useRef(0);

  const fail = useCallback((message: string) => setState({ phase: "idle", message }), []);

  const upload = useCallback(
    async (file: File) => {
      const rejection = rejectionOf(file);

      if (rejection) {
        fail(rejection);

        return;
      }

      const run = (generation.current += 1);
      const current = () => generation.current === run;

      setState({ phase: "uploading", file, bytesSent: 0, bytesTotal: file.size });

      const created = await createResumeAction({ fileName: file.name, sizeBytes: file.size, sha256: await sha256Of(file) });

      if (!current()) {
        return;
      }

      if (!created.ok) {
        fail(created.message);

        return;
      }

      const { resume, upload: presigned } = created.value;

      if (!presigned) {
        setState(tracked(resume));

        return;
      }

      const transfer = putBytes(presigned.url, presigned.headers, file, (sent) =>
        setState((previous) => (previous.phase === "uploading" && current() ? { ...previous, bytesSent: sent } : previous)),
      );

      setState((previous) => (previous.phase === "uploading" ? { ...previous, request: transfer.request } : previous));

      if (!(await transfer.done)) {
        if (current()) {
          fail(PUT_FAILED_MESSAGE);
        }

        return;
      }

      const completed = await completeResumeAction(resume.id);

      if (current()) {
        setState(completed.ok ? tracked(completed.value) : { phase: "idle", message: completed.message });
      }
    },
    [fail],
  );

  const cancel = useCallback(() => {
    generation.current += 1;
    setState((previous) => {
      if (previous.phase === "uploading") {
        previous.request?.abort();
      }

      return { phase: "idle" };
    });
  }, []);

  const startOver = useCallback(() => {
    generation.current += 1;
    setState({ phase: "idle" });
  }, []);

  // While the record is uploaded or processing, the page asks the API again with the last
  // ETag after 1 s, 2 s, 4 s, 8 s, then every 10 s, until it is done or failed.
  useEffect(() => {
    if (state.phase !== "tracked" || !TRACKED_STATUSES.has(state.resume.status)) {
      return;
    }

    const { resume, etag, attempt } = state;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const read = await readResumeAction(resume.id, etag);

      if (cancelled) {
        return;
      }

      setState((previous) => {
        if (previous.phase !== "tracked" || previous.resume.id !== resume.id) {
          return previous;
        }

        if (!read.ok || !read.value.changed) {
          return { ...previous, attempt: previous.attempt + 1 };
        }

        return tracked(read.value.resume, read.value.etag);
      });
    }, pollDelayMs(attempt));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state]);

  return { state, upload, cancel, startOver };
}

const IDLE_LEAD =
  "We read it once and build your profile automatically — headline, links, experience, education, skills, projects, certifications and languages. You can review everything afterwards.";
const PROCESSING_LEAD = "Keep this tab open. We upload the file, queue it for processing and fill your profile as the data comes back.";
const DONE_LEAD = "We pulled everything below out of your PDF. Check it over — anything we got wrong is one click from being fixed.";

export function ResumeUploadFlow({ initialResume, profileHref }: ResumeUploadFlowProps) {
  const { state, upload, cancel, startOver } = useResumeUploadFlow(initialResume);

  if (state.phase === "idle") {
    return (
      <>
        <ScreenHeading size="large" eyebrow="First things first" title="Upload your résumé" lead={IDLE_LEAD} />
        <UploadDropArea hint={DROP_HINT} message={state.message} onFile={upload} />
      </>
    );
  }

  const view = viewOf(state);
  const rows = profileDataRowsOf(view);
  const progress = { percentage: percentageOf(view), stages: stagesOf(view), rows, found: foundCountOf(rows) };
  const fileName = state.phase === "uploading" ? state.file.name : state.resume.fileName;
  const size = formatSize(state.phase === "uploading" ? state.file.size : state.resume.sizeBytes);
  const uploadAgain = (
    <Button variant="secondary" type="button" onClick={startOver}>
      Upload a different PDF
    </Button>
  );

  if (state.phase === "tracked" && state.resume.status === "done") {
    return (
      <>
        <ScreenHeading size="large" eyebrow="All set" title="Your profile is ready" lead={DONE_LEAD} />
        <IngestionProgress
          {...progress}
          file={{ name: fileName, meta: `${size} · processed` }}
          actions={
            <>
              <Button href={profileHref}>Review my profile</Button>
              {uploadAgain}
            </>
          }
          footnote="We deleted the original PDF once it was read."
        />
      </>
    );
  }

  if (state.phase === "tracked" && state.resume.status === "failed") {
    return (
      <>
        <ScreenHeading size="large" eyebrow="Something went wrong" title="We couldn't read that PDF" lead={failureLeadOf(state.resume.errorCode)} />
        <IngestionProgress {...progress} file={{ name: fileName, meta: `${size} · failed` }} actions={uploadAgain} />
      </>
    );
  }

  const uploading = state.phase === "uploading";

  return (
    <>
      <ScreenHeading size="large" eyebrow="Working on it" title="Reading your résumé" lead={PROCESSING_LEAD} />
      <IngestionProgress
        {...progress}
        file={{ name: fileName, meta: `${size} · ${uploading ? "uploading" : "processing"}` }}
        actions={
          uploading ? (
            <Button variant="secondary" type="button" onClick={cancel}>
              Cancel upload
            </Button>
          ) : undefined
        }
        footnote="Usually takes under a minute."
      />
    </>
  );
}
