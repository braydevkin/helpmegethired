# Security

The security requirements the code is held to. Each section is agreed in its own issue before the feature it protects is built, and the tasks that build the feature copy the section's acceptance criteria. The design behind each section is in [architecture.md](architecture.md); this document fixes the limits, the checks, and where each check runs. Nothing here is duplicated on the wiki, which is public.

## Resume PDF upload (FR-02, TC-01)

Agreed in #52 for the upload tasks (#73, #74, #75). The pipeline is described under "Resume upload and extraction" in [architecture.md](architecture.md#resume-upload-and-extraction-fr-02-tc-01); the object store is ADR-0021 and the worker is ADR-0020.

### Limits

| Limit | Value | Where it lives |
| --- | --- | --- |
| Size | 5 MB | `RESUME_MAX_SIZE_BYTES` in `packages/shared` |
| Pages | 20 | `RESUME_MAX_PAGES` in `packages/shared` |
| Presigned URL lifetime | 5 minutes | `PRESIGN_EXPIRES_SECONDS` in the API configuration |
| Extraction timeout | 30 seconds per file | `EXTRACTION_TIMEOUT_MS` in the worker configuration |

The design pages and the web app quote the size and the page count from the shared constants, never from a literal.

### Where the bytes go

- The browser sends the file straight to the object store through a presigned `PUT`. Neither the web app nor the API ever holds the bytes.
- The presigned URL signs the content type (`application/pdf`), the content length, and the SHA-256 the browser declared in `POST /resumes`, so the store refuses a different file. It expires 5 minutes after it is issued.
- The object key is `resumes/{accountId}/{uploadedResumeId}.pdf` in a private bucket that denies anonymous access. A listing never mixes Accounts, and no object is reachable without a signed URL.
- The file is deleted from the bucket as soon as its text is saved on the Uploaded Resume, and again when the record fails. The reconciliation job deletes objects whose record is `expired` or `failed`, or that have no record, after 7 days. No PDF outlives extraction, and reprocessing reads the stored text, never the file.

### What is checked, and where

| Check | Browser | API (`POST /resumes`) | Object store | Worker |
| --- | --- | --- | --- | --- |
| Name ends in `.pdf` | yes, inline message | `ResumeUploadSchema` | | |
| Size at most 5 MB | yes, inline message | `ResumeUploadSchema` | signed content length | size of the streamed object |
| Same bytes as declared | | | signed SHA-256 | |
| Bytes start with `%PDF-` | | | | yes, `not_pdf` |
| At most 20 pages | | | | yes, `too_many_pages` |
| Not password-protected | | | | yes, `encrypted_pdf` |
| Readable structure | | | | yes, `corrupt_pdf` |
| Holds text, not only images | | | | yes, `scanned_pdf` |

The MIME type is decided by the magic bytes in the worker, never by the file extension or by a header, because the API never sees the bytes and a header is whatever the client says. The browser and the API checks exist only to answer early; the worker's checks are the ones that hold.

### The extractor

- Extraction runs only in the `worker` service, never in the API process, so a hostile file can exhaust the worker and nothing else.
- `pdftotext` from poppler runs as a child process fed by the storage stream, with a timeout (`EXTRACTION_TIMEOUT_MS`, 30 s by default) and a memory limit on the container. A hung extraction is killed and retried; after the attempts the record is `failed` with `extraction_failed`.
- `pdfjs-dist` is the fallback when poppler is unavailable or fails transiently. Neither extractor has network access, renders pages, or executes anything embedded in the file: JavaScript actions, links, and attachments are ignored.
- Scanned detection: fewer than 200 non-blank characters on a file over 50 KB is `scanned_pdf`. OCR is out of this phase.

### Error codes

`ResumeUploadErrorCodeSchema` in `packages/shared` is the closed list. The upload page has one message per code ([Design: Resume Upload](https://github.com/braydevkin/helpmegethired/wiki/Design-Resume-Upload)).

| Code | Decided by | Meaning |
| --- | --- | --- |
| `not_pdf` | API (name), worker (magic bytes) | The file is not a PDF |
| `too_large` | API (declared size), store (signed length), worker (streamed size) | Over 5 MB |
| `too_many_pages` | Worker | Over 20 pages |
| `encrypted_pdf` | Worker | Password-protected |
| `corrupt_pdf` | Worker | The structure cannot be read |
| `scanned_pdf` | Worker | No extractable text |
| `upload_incomplete` | API (`complete`) | The object is missing or its size differs from the declared one |
| `extraction_failed` | Worker | A transient failure that outlived the retries |
| `profile_build_failed` | Worker | The Ingestion built from the text exhausted its attempts |
| `ingestion_active` | API (`complete`) | Another upload or Ingestion of the Account is in flight (TC-05) |

### Hostile fixtures

`apps/api/test/fixtures/resumes/hostile` holds one file per attack the integration tests of the extraction task feed the worker, with a README naming what each exercises and its expected outcome: wrong magic bytes, a malformed cross-reference table, a password-protected file, an image-only scan, embedded JavaScript, and a file over the size limit. They are generated by a script in that directory and hold no real data.

### Open items

- **Virus scanning** of the uploaded file: decided once the deployment target is known, because the scanner is an infrastructure component. Tracked in the pending decisions of the ADR index.
- **Encryption at rest** of the bucket: a property of the deployment target, not of the code. The design pages make no claim about it.
