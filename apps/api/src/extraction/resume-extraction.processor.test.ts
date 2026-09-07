import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import { RESUME_MAX_PAGES, RESUME_MAX_SIZE_BYTES, type Id, type ResumeUploadErrorCode } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { UploadedResumeNotFoundError } from "../resumes/resume-errors";
import { ObjectStorage, type ListedObject, type PresignedUpload, type StoredObject } from "../storage/object-storage";
import { corruptPdf, encryptedPdf } from "./extraction-errors";
import { ExtractionHandover } from "./extraction-handover";
import { PdfInspector, type PdfFacts } from "./pdf-inspector";
import { ResumeExtractionProcessor } from "./resume-extraction.processor";
import { SCANNED_DETECTION_MIN_BYTES } from "./scanned-detection";
import { TextExtractor, type ExtractedText } from "./text-extractor";
import { UploadedResumeRunRepository, type ExtractionRecord } from "./uploaded-resume-run.repository";

const AWAITING_EXTRACTION = new Set<ExtractionRecord["status"]>(["uploaded", "processing"]);

class InMemoryRecords {
  readonly records = new Map<Id, ExtractionRecord & { errorCode: ResumeUploadErrorCode | null; errorMessage: string | null }>();

  add(overrides: Partial<ExtractionRecord> = {}): ExtractionRecord {
    const id = randomUUID();
    const record = {
      id,
      accountId: randomUUID(),
      objectKey: `resumes/${id}.pdf`,
      sizeBytes: 1_024,
      status: "uploaded" as const,
      attempts: 0,
      maxAttempts: 3,
      rawText: null,
      extractorVersion: null,
      ingestionId: null,
      createdAt: new Date(),
      errorCode: null,
      errorMessage: null,
      ...overrides,
    };

    this.records.set(id, record);

    return record;
  }

  stored(id: Id) {
    const record = this.records.get(id);

    if (!record) {
      throw new Error(`No record ${id}`);
    }

    return record;
  }

  findById(id: Id): Promise<ExtractionRecord | undefined> {
    return Promise.resolve(this.records.get(id));
  }

  beginAttempt(id: Id): Promise<ExtractionRecord | undefined> {
    const record = this.records.get(id);

    if (!record || !AWAITING_EXTRACTION.has(record.status) || record.attempts >= record.maxAttempts) {
      return Promise.resolve(undefined);
    }

    Object.assign(record, { status: "processing", attempts: record.attempts + 1 });

    return Promise.resolve({ ...record });
  }

  saveText(id: Id, extracted: ExtractedText): Promise<ExtractionRecord> {
    const record = this.stored(id);

    Object.assign(record, { rawText: extracted.text, extractorVersion: extracted.extractorVersion, errorMessage: null });

    return Promise.resolve({ ...record });
  }

  markDone(id: Id): Promise<void> {
    Object.assign(this.stored(id), { status: "done", errorCode: null, errorMessage: null });

    return Promise.resolve();
  }

  markFailed(id: Id, code: ResumeUploadErrorCode, message: string): Promise<void> {
    Object.assign(this.stored(id), { status: "failed", errorCode: code, errorMessage: message });

    return Promise.resolve();
  }

  recordError(id: Id, message: string): Promise<void> {
    Object.assign(this.stored(id), { errorMessage: message });

    return Promise.resolve();
  }
}

class InMemoryStorage extends ObjectStorage {
  readonly objects = new Map<string, Buffer>();
  failDeletes = false;

  presignPut(): Promise<PresignedUpload> {
    return Promise.reject(new Error("not used"));
  }

  head(key: string): Promise<StoredObject | undefined> {
    const object = this.objects.get(key);

    return Promise.resolve(object && { size: object.length });
  }

  getStream(key: string): Promise<Readable> {
    const object = this.objects.get(key);

    return object ? Promise.resolve(Readable.from([object])) : Promise.reject(new Error(`NoSuchKey: ${key}`));
  }

  delete(key: string): Promise<void> {
    if (this.failDeletes) {
      return Promise.reject(new Error("storage unreachable"));
    }

    this.objects.delete(key);

    return Promise.resolve();
  }

  list(prefix: string): Promise<ListedObject[]> {
    return Promise.resolve(
      [...this.objects.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key, lastModified: new Date() })),
    );
  }
}

class ScriptedInspector extends PdfInspector {
  outcome: PdfFacts | Error = { pages: 1 };

  override inspect(): Promise<PdfFacts> {
    return this.outcome instanceof Error ? Promise.reject(this.outcome) : Promise.resolve(this.outcome);
  }
}

class ScriptedExtractor extends TextExtractor {
  outcome: ExtractedText | Error = { text: "Ada Lovelace - Senior Software Engineer", extractorVersion: "pdftotext/9.9.9" };
  calls = 0;

  extract(): Promise<ExtractedText> {
    this.calls += 1;

    return this.outcome instanceof Error ? Promise.reject(this.outcome) : Promise.resolve(this.outcome);
  }
}

class RecordingHandover extends ExtractionHandover {
  readonly handedOver: Id[] = [];

  constructor(private readonly records: InMemoryRecords) {
    super();
  }

  handOver(record: ExtractionRecord): Promise<void> {
    this.handedOver.push(record.id);

    return this.records.markDone(record.id);
  }
}

const pdfBytes = (length = 1_024) => Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(length, 0x20)]).subarray(0, length);

function harness() {
  const records = new InMemoryRecords();
  const storage = new InMemoryStorage();
  const inspector = new ScriptedInspector();
  const extractor = new ScriptedExtractor();
  const handover = new RecordingHandover(records);
  const processor = new ResumeExtractionProcessor(
    records as unknown as UploadedResumeRunRepository,
    storage,
    inspector,
    extractor,
    handover,
  );

  const uploaded = (bytes: Buffer, overrides: Partial<ExtractionRecord> = {}) => {
    const record = records.add({ sizeBytes: bytes.length, ...overrides });

    storage.objects.set(record.objectKey, bytes);

    return record;
  };

  return { records, storage, inspector, extractor, handover, processor, uploaded };
}

describe("ResumeExtractionProcessor", () => {
  it("extracts a text PDF, stores the text with the extractor version, deletes the object, and hands over", async () => {
    const { records, storage, extractor, handover, processor, uploaded } = harness();
    const record = uploaded(pdfBytes());

    await processor.process(record.id);

    expect(records.stored(record.id)).toMatchObject({
      status: "done",
      attempts: 1,
      rawText: "Ada Lovelace - Senior Software Engineer",
      extractorVersion: "pdftotext/9.9.9",
      errorCode: null,
    });
    expect(storage.objects.has(record.objectKey)).toBe(false);
    expect(handover.handedOver).toEqual([record.id]);
    expect(extractor.calls).toBe(1);
  });

  it("does nothing for a record that is already done", async () => {
    const { records, extractor, handover, processor, uploaded } = harness();
    const record = uploaded(pdfBytes(), { status: "done", attempts: 1, rawText: "kept" });

    await processor.process(record.id);

    expect(records.stored(record.id)).toMatchObject({ status: "done", attempts: 1 });
    expect(extractor.calls).toBe(0);
    expect(handover.handedOver).toEqual([]);
  });

  it("never extracts again once the text is stored: a re-delivered job deletes the object and hands over", async () => {
    const { records, storage, extractor, handover, processor, uploaded } = harness();
    const record = uploaded(pdfBytes(), { status: "processing", attempts: 3, rawText: "stored earlier", extractorVersion: "pdftotext/9.9.9" });

    await processor.process(record.id);

    expect(records.stored(record.id)).toMatchObject({ status: "done", attempts: 3, rawText: "stored earlier" });
    expect(storage.objects.has(record.objectKey)).toBe(false);
    expect(handover.handedOver).toEqual([record.id]);
    expect(extractor.calls).toBe(0);
  });

  it.each([
    ["not_pdf", Buffer.from("<!doctype html>"), (h: ReturnType<typeof harness>) => h],
    [
      "too_large",
      Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(RESUME_MAX_SIZE_BYTES, 0x41)]),
      (h: ReturnType<typeof harness>) => h,
    ],
    ["too_many_pages", pdfBytes(), (h: ReturnType<typeof harness>) => Object.assign(h.inspector, { outcome: { pages: RESUME_MAX_PAGES + 1 } })],
    ["encrypted_pdf", pdfBytes(), (h: ReturnType<typeof harness>) => Object.assign(h.inspector, { outcome: encryptedPdf() })],
    ["corrupt_pdf", pdfBytes(), (h: ReturnType<typeof harness>) => Object.assign(h.extractor, { outcome: corruptPdf("no trailer") })],
    [
      "scanned_pdf",
      pdfBytes(SCANNED_DETECTION_MIN_BYTES + 1),
      (h: ReturnType<typeof harness>) => Object.assign(h.extractor, { outcome: { text: " \n ", extractorVersion: "pdftotext/9.9.9" } }),
    ],
  ])("fails the record with %s, stores no text, and deletes the object", async (code, bytes, arrange) => {
    const h = harness();
    arrange(h);
    const record = h.uploaded(bytes);

    await h.processor.process(record.id);

    expect(h.records.stored(record.id)).toMatchObject({ status: "failed", errorCode: code, rawText: null, attempts: 1 });
    expect(h.records.stored(record.id).errorMessage).toEqual(expect.any(String));
    expect(h.storage.objects.has(record.objectKey)).toBe(false);
    expect(h.handover.handedOver).toEqual([]);
  });

  it("keeps a document with a legitimate JavaScript action when its text extracts", async () => {
    const { records, processor, uploaded } = harness();
    const record = uploaded(pdfBytes());

    await processor.process(record.id);

    expect(records.stored(record.id).status).toBe("done");
  });

  it("records a transient failure, keeps the object, and rethrows so the queue retries", async () => {
    const { records, storage, extractor, processor, uploaded } = harness();
    const record = uploaded(pdfBytes());
    extractor.outcome = new Error("storage unreachable");

    await expect(processor.process(record.id)).rejects.toThrow("storage unreachable");

    expect(records.stored(record.id)).toMatchObject({
      status: "processing",
      attempts: 1,
      rawText: null,
      errorCode: null,
      errorMessage: "storage unreachable",
    });
    expect(storage.objects.has(record.objectKey)).toBe(true);
  });

  it("fails with extraction_failed and deletes the object when a transient failure uses the last attempt", async () => {
    const { records, storage, extractor, processor, uploaded } = harness();
    const record = uploaded(pdfBytes(), { status: "processing", attempts: 2 });
    extractor.outcome = new Error("pdftotext on the document took longer than 30000 ms");

    await expect(processor.process(record.id)).rejects.toThrow("longer than");

    expect(records.stored(record.id)).toMatchObject({
      status: "failed",
      attempts: 3,
      errorCode: "extraction_failed",
      errorMessage: expect.stringContaining("longer than"),
    });
    expect(storage.objects.has(record.objectKey)).toBe(false);
  });

  it("fails a record delivered with every attempt already used", async () => {
    const { records, storage, extractor, processor, uploaded } = harness();
    const record = uploaded(pdfBytes(), { status: "processing", attempts: 3 });

    await processor.process(record.id);

    expect(records.stored(record.id)).toMatchObject({ status: "failed", attempts: 3, errorCode: "extraction_failed" });
    expect(storage.objects.has(record.objectKey)).toBe(false);
    expect(extractor.calls).toBe(0);
  });

  it.each(["pending", "failed", "expired"] as const)("leaves a %s record alone", async (status) => {
    const { records, storage, extractor, processor, uploaded } = harness();
    const record = uploaded(pdfBytes(), { status });

    await processor.process(record.id);

    expect(records.stored(record.id)).toMatchObject({ status, attempts: 0 });
    expect(storage.objects.has(record.objectKey)).toBe(true);
    expect(extractor.calls).toBe(0);
  });

  it("reports an unknown record", async () => {
    await expect(harness().processor.process(randomUUID())).rejects.toThrow(UploadedResumeNotFoundError);
  });

  it("finishes even when the object cannot be deleted", async () => {
    const { records, storage, handover, processor, uploaded } = harness();
    const record = uploaded(pdfBytes());
    storage.failDeletes = true;

    await processor.process(record.id);

    expect(records.stored(record.id).status).toBe("done");
    expect(handover.handedOver).toEqual([record.id]);
    expect(storage.objects.has(record.objectKey)).toBe(true);
  });
});
