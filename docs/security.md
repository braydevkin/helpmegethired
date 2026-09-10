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
- The object is read into memory up to the size limit and refused one byte over it; the magic bytes and, through `pdfjs-dist` opening the document without rendering, the page count and the absence of encryption are checked before any child process sees the bytes.
- `pdftotext` from poppler runs as a child process fed through its standard input, with a timeout (`EXTRACTION_TIMEOUT_MS`, 30 s by default) and the memory limit of the worker container. A hung extraction is killed and retried; after the attempts the record is `failed` with `extraction_failed`.
- `pdfjs-dist` is the fallback when poppler cannot be started or stops for a reason that is not the document's. Neither extractor has network access, renders pages, or executes anything embedded in the file: JavaScript actions, links, and attachments are ignored.
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

## AI pipeline (TC-06, TC-07)

Agreed in #53 before the first model call, for every task that reaches a model: Profile Curation (#110, #111, #113, #114, #119) and every Job Description layer after it, starting with the ATS scoring task. Who holds which key is ADR-0023; the pipeline is "AI pipeline" in [architecture.md](architecture.md#ai-pipeline-tc-06-tc-07).

Every text a model reads is attacker-controlled: the stored Resume text, the Profile the Candidate edited, a pasted Job Description. The rules assume that text will try to instruct the model, and they hold when the model obeys it: what protects the platform is what the code does before and after the call, never what the prompt asks for.

### Keys

| Key | Belongs to | Lives in | Never |
| --- | --- | --- | --- |
| Platform embedding key | The platform | The API and worker environment, validated at startup; a production configuration without it refuses to start | In the web app, a response, or a log line |
| Model Key | The Candidate | `account_model_choices`, encrypted at rest (#110) | Returned by any endpoint, in a log line, an error message, an exception payload, or the OpenAPI document, or handled by the web app's server side |
| Model Key encryption key | The platform | The API and worker environment, validated at startup; a production configuration without it refuses to start | In the database, next to what it encrypts |

- The Model Key travels from the browser to the API and never enters the web app process: it is not submitted through a Next.js server action or route handler, and `apps/web/src/proxy.ts` forwards no bodies (ADR-0023).
- A key is checked against the Provider when it is saved, so an invalid one is refused where the Candidate can fix it. Reading the Model Choice answers whether a key is stored, never the key or a fragment that could be decrypted.
- Revoking a key deletes its ciphertext. The Model Choice stays, and new analyses are blocked with a reason.
- An Account with no Model Key is blocked, never served by the deterministic fake: the fake is selected by platform configuration, and only outside production (ADR-0023).

### Prompts

- System instructions and Candidate content are separate parts of the prompt. Candidate content is wrapped in explicit delimiters, and the instructions say that everything inside them is data to analyse, never an instruction to follow.
- A delimiter that appears inside the content is neutralised before wrapping, so the content cannot close its own block and continue as instructions.
- The deterministic facts computed by the platform (#108) sit outside the Candidate block and are labelled as computed, so the text cannot restate them.
- A prompt carries the content of one Account only.
- Each Curation Unit's input is capped at 8,000 characters, truncated at a line boundary, and the unit records that it was truncated (#113).
- No tool that can perform a side effect is exposed to the model. Retrieval is done by the code before the call, never by the model choosing to call something.

### Retrieval

- Every retrieval query filters by `account_id` in SQL, before similarity ordering, under the same structural rule as every Candidate-owned table ([architecture.md](architecture.md#backend-appsapi), #49). No query retrieves across Accounts, and the two-Account helper proves it for every retrieval path.
- Profile Curation is the one layer that reads the Profile, one Curation Unit at a time, because it is what produces the Statements; it retrieves nothing (ADR-0024). Every layer after it retrieves only Statements: never the Profile rows, never the extracted text. A rejected Statement and the Statements of a superseded Curation are never retrieved (#119).

### Output

- Every model response is parsed by a Zod schema from `packages/shared`. A response that does not validate is a failed call: it is never repaired, never partially saved, and never shown.
- The ATS score is an integer from 0 to 10, and nothing else validates.
- A Statement's Evidence must resolve against the Account's own Profile before the Statement is saved. One that does not is discarded, and the discard is logged by unit id (#113).
- Model output, and every attacker-controlled text it was drawn from (the Resume text, the Profile, a Job Description), reach the web app as data and are rendered as text. None of them reaches `dangerouslySetInnerHTML` or a Markdown renderer that passes HTML through.

### Spend

- Generation is billed to the Candidate's own Provider account, and the platform enforces no budget on it. What bounds a Curation is `max_attempts` (3) and the per-unit input cap (ADR-0023).
- Embedding is the platform's only spend. Each Account has an embedding budget over a period, with a stored counter checked before every embedding call, never after. An Account that reaches it has its Curation paused with a reason the Candidate can read and a `resume_after`, not failed. #133 fixes the number and the period, measured against the corpus, and lands before the platform embedding key is set in any public environment.
- A Provider rate limit or an exhausted quota pauses the run with `resume_after` and does not consume an attempt. Nothing retries against a Provider in a loop (#115).

### Logging

Each model call writes one structured line (#50): the Account id, the id of the run and of the unit, the Model, the prompt version, input and output token counts, latency, and the outcome (`ok`, `invalid_output`, `evidence_unresolved`, `timeout`, `rate_limited`, `failed`). The reason recorded on a unit row is that outcome, never the Provider's message.

A log line, a unit row, and an error payload never carry the prompt, the completion, Candidate content, a Statement or its Evidence, the Model Key, or a Provider error body, which can echo the input it refused. Token counts are recorded for this log and never shown to a Candidate (ADR-0023).

### Injection fixtures

`apps/api/test/fixtures/injection` holds a Resume text and a Job Description that try to steer the model, with a README naming each attempt and the expected outcome. They contain no real person's data. Each layer's tests run them through its guards against the deterministic fake: delimiter neutralisation, schema validation, Evidence resolution, and the canary check below. The ATS scoring task runs them too, asserting that the score still validates. With a real Model Key the same fixtures form an evaluation run, never a CI step, because CI holds no Provider key.

The canary: the system instructions of a test prompt carry a random marker, and a completion that contains it, or any line of the instructions, fails the test. A leak of the prompt is caught by what the output contains, not by trusting the model to refuse.

### Criteria each task copies

- [ ] Candidate content reaches the model only inside the delimiters, and a delimiter inside the content is neutralised
- [ ] No tool with a side effect is exposed to the model
- [ ] Every retrieval query filters by `account_id`, proven by the two-Account helper
- [ ] Every response is parsed by a shared Zod schema, and one that does not validate is a failed call
- [ ] No key reaches the web app, a response body, a log line, or an error payload
- [ ] A log line carries ids, the Model, the prompt version, token counts, latency, and the outcome, and a test asserts it carries no content
- [ ] The injection fixtures run through the layer, the output validates, and the canary never appears

### Still open for the AI pipeline

- **The embedding ceiling's number and period**: #133.
- **Provider retention**: a Profile sent for generation is governed by the Candidate's own agreement with their Provider, not by one the platform holds (ADR-0023). The provider page states it (#120); the platform makes no claim of its own.
