# ADR-0021: S3-compatible object storage for Uploaded Resumes, with RustFS as the local store

- **Status:** Accepted
- **Date:** 2026-09-06
- **Deciders:** @braydevkin

## Context

FR-02 uploads a Resume as a PDF of at most 5 MB and 20 pages (#52). The upload design (#71, [Design: Resume Upload](https://github.com/braydevkin/helpmegethired/wiki/Design-Resume-Upload)) sends the bytes from the browser straight to storage through a presigned URL, so neither `apps/web` nor `apps/api` ever holds the file; the `worker` (ADR-0020) streams it, extracts the text, and deletes it. The file therefore needs a store that:

- **Signs URLs** for a browser `PUT` that fixes the content type, the size, and the SHA-256, so a different file is refused by the store itself.
- **Is reachable under two names**: an internal endpoint for the API and the worker inside the compose network, and a public endpoint the browser can reach, embedded in the presigned URL.
- **Runs in compose and CI** with no account or key, like everything else in the stack (ADR-0007).
- **Is not a vendor**: the deployment target is undecided (pending decisions in the ADR index), so the code must run unchanged against whichever S3-compatible host the environment names.

MinIO was the first candidate and the name the design pages carried. Between mid 2025 and February 2026 MinIO reduced its community console to an object browser, stopped publishing Docker images for the community edition, and archived its repository, leaving only enterprise builds. An unmaintained image was not a foundation for a new decision.

## Decision

**Uploaded Resumes live in S3-compatible object storage, reached only through the AWS S3 client library behind an `ObjectStorage` abstraction. RustFS is the store in the compose stack and in CI.**

- **RustFS** (Apache 2.0, official `rustfs/rustfs` image) runs as the `storage` compose service with a persistent volume and a health check, the S3 API on port 9000 and its web console on port 9001, mapped to `STORAGE_PORT` and `STORAGE_CONSOLE_PORT`. A `storage-init` container creates the private `resumes` bucket and sets its CORS to the web origin. The service is named for its role, not its product, so a later swap renames nothing.
- **Two S3 clients, one library.** The API and the worker read, head, and delete through `S3_ENDPOINT` (internal). Only the client on `S3_PUBLIC_ENDPOINT` signs the browser's URL. Both use path-style URLs. `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `S3_REGION` complete the configuration; every variable is validated at boot and switching them to another S3-compatible host needs no code change. Nothing in the code depends on a RustFS-specific API.
- **The presigned `PUT`** signs the content type, the content length, and the SHA-256 and expires in `PRESIGN_EXPIRES_SECONDS` (default 300). The object key is `resumes/{accountId}/{uploadedResumeId}.pdf`, so a bucket listing never mixes Accounts.
- **The API never takes the browser's word that the upload finished.** `POST /resumes/:id/complete` heads the object and compares its size with the declared one, retrying three times 500 ms apart before answering `409 upload_incomplete`, and the reconciliation job (ADR-0020) promotes a `pending` record whose object shows up later. A store without read-after-write consistency still converges; on one that has it, the first call succeeds.
- **The PDF does not outlive extraction.** The worker deletes the object as soon as the raw text is saved on the Uploaded Resume, and again when the record fails. The reconciliation job (ADR-0020) deletes objects whose record is `expired` or `failed`, or that have no record, after seven days. Reprocessing reads the stored text, never the PDF.
- **The RustFS console** is the local dashboard for the bucket: what objects exist, which are orphaned, and whether the delete happened. It is a development tool, not part of any deployed environment.

## Alternatives considered

- **MinIO**: the original choice and a drop-in equivalent, rejected because its community edition is archived and no maintained image exists; pinning the last one would start the project on abandoned software.
- **`bytea` in PostgreSQL**: no new service, the file in the same transaction as the record. Rejected because the browser would then upload through the API, which is exactly what the design avoids: a 5 MB body in the request process, a presigned URL impossible, and the deleted-after-extraction rule applied to table bloat instead of an object.
- **LocalStack or another S3 emulator**: only an emulator, with no console and a heavier image, for the same S3 API RustFS serves natively.
- **Garage or SeaweedFS**: both S3-compatible and maintained; Garage has no console and SeaweedFS's S3 gateway is one component among many. RustFS is the closest match to what the design already assumed.

## Consequences

- Positive: the browser uploads directly and the API never touches the bytes; the same code runs against any S3-compatible host; the store is inspectable locally through its console; the PDF is deleted deterministically.
- Negative: one more service in compose and CI; two endpoints to configure; object storage adds a second store the reconciliation job has to keep coherent with PostgreSQL.
- Follow-ups: the object store for the test and production environments once the deployment target is decided; a virus scanning step, documented as open in #52.
