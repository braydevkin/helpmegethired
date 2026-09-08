import type { UploadedResume } from "@helpmegethired/shared";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { completeResumeAction, createResumeAction, readResumeAction } from "./actions";
import { ResumeUploadFlow } from "./resume-upload-flow";

vi.mock("./actions", () => ({ createResumeAction: vi.fn(), completeResumeAction: vi.fn(), readResumeAction: vi.fn() }));
vi.mock("../../../../lib/resume-upload/sha256", () => ({ sha256Of: vi.fn().mockResolvedValue("a".repeat(64)) }));

const resume = (overrides: Partial<UploadedResume> = {}): UploadedResume => ({
  id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  accountId: "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91",
  createdAt: "2026-09-08T10:00:00.000Z",
  source: "upload",
  fileName: "ada.pdf",
  contentType: "application/pdf",
  sizeBytes: 8,
  sha256: "a".repeat(64),
  status: "uploaded",
  errorCode: null,
  finishedAt: null,
  progress: null,
  ...overrides,
});

const presigned = { url: "https://storage.test/resumes/x.pdf", method: "PUT" as const, headers: { "content-type": "application/pdf" }, expiresAt: "2026-09-08T10:05:00.000Z" };

class FakeXhr {
  static instances: FakeXhr[] = [];
  upload = { onprogress: undefined as ((event: { loaded: number }) => void) | undefined };
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  status = 0;
  headers: Record<string, string> = {};
  url = "";
  sent?: unknown;
  aborted = false;

  constructor() {
    FakeXhr.instances.push(this);
  }

  open(_method: string, url: string) {
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.sent = body;
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  finish(status: number) {
    this.status = status;
    this.onload?.();
  }
}

const pickFile = (file: File) => {
  const input = document.querySelector("input[type=file]") as HTMLInputElement;

  fireEvent.change(input, { target: { files: [file] } });
};

const pdf = new File(["%PDF-1.7"], "ada.pdf", { type: "application/pdf" });

describe("ResumeUploadFlow", () => {
  beforeEach(() => {
    FakeXhr.instances = [];
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("starts idle with the designed copy", () => {
    render(<ResumeUploadFlow initialResume={null} profileHref="/journey/profile" />);

    expect(screen.getByText("First things first")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Upload your résumé");
    expect(screen.getByText("PDF only · up to 5 MB · one file")).toBeInTheDocument();
  });

  it("refuses a PNG and an oversized PDF in the browser and sends nothing", () => {
    render(<ResumeUploadFlow initialResume={null} profileHref="/journey/profile" />);

    pickFile(new File(["png"], "ada.png", { type: "image/png" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That file is not a PDF. Export your résumé as PDF and try again.");

    const oversized = new File(["x"], "big.pdf", { type: "application/pdf" });

    Object.defineProperty(oversized, "size", { value: 6 * 1024 * 1024 });
    pickFile(oversized);
    expect(screen.getByRole("alert")).toHaveTextContent("That PDF is over 5 MB. Compress it or remove heavy images.");
    expect(createResumeAction).not.toHaveBeenCalled();
    expect(FakeXhr.instances).toHaveLength(0);
  });

  it("reserves the record, PUTs the bytes with progress, completes, and then tracks the record", async () => {
    vi.mocked(createResumeAction).mockResolvedValue({ ok: true, value: { resume: resume({ status: "pending" }), upload: presigned } });
    vi.mocked(completeResumeAction).mockResolvedValue({ ok: true, value: resume({ status: "uploaded" }) });
    vi.mocked(readResumeAction).mockResolvedValue({ ok: true, value: { changed: false } });
    render(<ResumeUploadFlow initialResume={null} profileHref="/journey/profile" />);

    pickFile(pdf);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Reading your résumé");
    await waitFor(() => expect(FakeXhr.instances).toHaveLength(1));
    expect(createResumeAction).toHaveBeenCalledWith({ fileName: "ada.pdf", sizeBytes: pdf.size, sha256: "a".repeat(64) });

    const transfer = FakeXhr.instances[0]!;

    expect(transfer.url).toBe(presigned.url);
    expect(transfer.headers).toEqual(presigned.headers);
    expect(transfer.sent).toBe(pdf);
    expect(screen.getByRole("button", { name: "Cancel upload" })).toBeInTheDocument();

    act(() => transfer.upload.onprogress?.({ loaded: pdf.size / 2 }));
    expect(screen.getByTestId("upload-percentage")).toHaveTextContent("12%");

    act(() => transfer.finish(200));

    await waitFor(() => expect(completeResumeAction).toHaveBeenCalledWith(resume().id));
    await waitFor(() => expect(screen.getByTestId("upload-percentage")).toHaveTextContent("25%"));
    expect(screen.getByText("Job registered and picked up by a worker.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel upload" })).not.toBeInTheDocument();
  });

  it("goes back to idle with the designed message when the PUT fails", async () => {
    vi.mocked(createResumeAction).mockResolvedValue({ ok: true, value: { resume: resume({ status: "pending" }), upload: presigned } });
    render(<ResumeUploadFlow initialResume={null} profileHref="/journey/profile" />);

    pickFile(pdf);
    await waitFor(() => expect(FakeXhr.instances).toHaveLength(1));
    act(() => FakeXhr.instances[0]!.onerror?.());

    expect(await screen.findByRole("alert")).toHaveTextContent("The upload didn't finish. Check your connection and try again.");
    expect(completeResumeAction).not.toHaveBeenCalled();
  });

  it("shows the API's refusal on the idle state", async () => {
    vi.mocked(createResumeAction).mockResolvedValue({ ok: false, message: "Your previous résumé is still being read. Wait for it to finish, then try again." });
    render(<ResumeUploadFlow initialResume={null} profileHref="/journey/profile" />);

    pickFile(pdf);

    expect(await screen.findByRole("alert")).toHaveTextContent("Your previous résumé is still being read.");
  });

  it("polls a tracked record with backoff and the last ETag until it is done", async () => {
    vi.useFakeTimers();
    const building = resume({ status: "processing", progress: { ingestionId: "0f8fad5b-d9cb-469f-a165-70867728950e", status: "running", percentage: 50, segments: { total: 4, saved: 2, savedKinds: ["header", "experience"] } } });
    const done = resume({ status: "done", finishedAt: "2026-09-08T10:01:00.000Z", progress: { ...building.progress!, status: "completed", percentage: 100, segments: { total: 4, saved: 4, savedKinds: ["header", "experience", "skills", "languages"] } } });

    vi.mocked(readResumeAction)
      .mockResolvedValueOnce({ ok: true, value: { changed: false } })
      .mockResolvedValueOnce({ ok: true, value: { changed: true, resume: building, etag: '"b"' } })
      .mockResolvedValueOnce({ ok: true, value: { changed: true, resume: done, etag: '"c"' } });
    render(<ResumeUploadFlow initialResume={resume({ status: "uploaded" })} profileHref="/journey/profile" />);

    expect(screen.getByTestId("upload-percentage")).toHaveTextContent("25%");

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(readResumeAction).toHaveBeenNthCalledWith(1, resume().id, undefined);

    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(readResumeAction).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("upload-percentage")).toHaveTextContent("65%");
    expect(screen.getByTestId("profile-data-count")).toHaveTextContent("6 of 11");
    expect(screen.getByText("Mapping experience, skills and languages.")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(readResumeAction).toHaveBeenNthCalledWith(3, resume().id, '"b"');
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your profile is ready");
    expect(screen.getByTestId("upload-percentage")).toHaveTextContent("100%");
    expect(screen.getByTestId("profile-data-count")).toHaveTextContent("11 of 11");
    expect(screen.getByRole("link", { name: "Review my profile" })).toHaveAttribute("href", "/journey/profile");
    expect(screen.getByText("We deleted the original PDF once it was read.")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(readResumeAction).toHaveBeenCalledTimes(3);
  });

  it("renders a failed record with the lead for its code and offers a new upload", () => {
    render(<ResumeUploadFlow initialResume={resume({ status: "failed", errorCode: "scanned_pdf" })} profileHref="/journey/profile" />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("We couldn't read that PDF");
    expect(screen.getByText(/This PDF is a scan or an image/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upload a different PDF" }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Upload your résumé");
  });
});
