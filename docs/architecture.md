# Architecture

This document describes the intended architecture. Nothing here is implemented yet; each part becomes a task in the GitHub Project before any code is written. Decisions are justified in [ADRs](adr/README.md).

## High-level view

```
┌───────────────────────────────────────────────────────────────────┐
│                          Help Me Get Hired                        │
│                                                                   │
│   ┌──────────────┐   HTTP/JSON    ┌──────────────────────────┐    │
│   │  apps/web    │ ─────────────▶ │  apps/api                │    │
│   │  Next.js     │ ◀───────────── │  NestJS                  │    │
│   └──────────────┘                │                          │    │
│          │                        │  ┌────────────────────┐  │    │
│          │  shared types/schemas  │  │ LangChain          │  │    │
│          ▼                        │  │  tools → services  │  │    │
│   ┌──────────────┐                │  └─────────┬──────────┘  │    │
│   │ packages/    │ ◀──────────────┤            │             │    │
│   │ shared       │                └────────────┼─────────────┘    │
│   └──────────────┘                             │                  │
│                                                ▼                  │
│   ┌──────────────┐  BullMQ jobs  ┌──────────────────────────┐    │
│   │ Redis        │ ◀──────────── │ PostgreSQL + pgvector    │    │
│   │ (queues)     │ ─────────┐    │  relational data + RAG   │    │
│   └──────────────┘          │    └──────────────────────────┘    │
│                             ▼                 ▲                  │
│   ┌──────────────┐  PDF   ┌──────────────────┴───────┐          │
│   │ Object store │ ─────▶ │ apps/api worker          │          │
│   │ (S3 API)     │ ◀───── │  extraction + ingestion  │          │
│   └──────────────┘ delete └──────────────────────────┘          │
│          ▲ presigned PUT from the browser                        │
└───────────────────────────────────────────────────────────────────┘
```

The web app talks to the API only. The API enqueues jobs on Redis (ADR-0020) and signs the URL the browser uploads to (ADR-0021); the worker, a second entrypoint of `apps/api`, consumes the queues, streams the PDF from the object store, and writes the Profile to PostgreSQL.

## Monorepo layout

```
helpmegethired/
├── apps/
│   ├── web/                # Next.js frontend
│   └── api/                # NestJS backend
├── packages/
│   ├── shared/             # Zod schemas and inferred types shared by web and api
│   ├── eslint-config/      # Shared lint rules
│   └── tsconfig/           # Shared TypeScript configs
├── e2e/                    # Playwright end-to-end tests against the running stack
├── docker/                 # Dockerfiles, one directory per service
├── docs/                   # This documentation
├── arch/                   # Diagrams
├── .github/                # Workflows, issue and PR templates
├── docker-compose.yml      # The whole stack for local development and CI
├── .env.example            # Variables read by docker-compose.yml
├── .nvmrc
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

Rules:

- Apps never import from each other. They share code only through `packages/*`. The shared ESLint configuration enforces this with the `helpmegethired/no-cross-app-imports` rule, which resolves each import to its target directory, so both `@helpmegethired/api` and a relative path like `../../api/src` are rejected from inside `apps/web`. Package code cannot import from an app either.
- `packages/shared` owns every type and schema that crosses the HTTP boundary. Schemas are written with Zod (ADR-0011) and each one exports its inferred type, so both apps validate against the same schema and share the same type. Vocabulary follows [CONTEXT.md](../CONTEXT.md).
- Turborepo pipelines: `build`, `lint`, `typecheck`, `test`, `test:e2e`. CI runs the same pipelines as local. `lint`, `typecheck` and `test` run after the `build` of the workspace dependencies so consumers see fresh outputs.

Workspace conventions:

- Every workspace package is named `@helpmegethired/<directory>`. Apps are `@helpmegethired/web` and `@helpmegethired/api`; the list of app directories lives in `packages/eslint-config` and is the only place to update when an app is added.
- Node and pnpm are pinned: `.nvmrc` selects the Node major, `packageManager` in the root `package.json` selects the exact pnpm version, and pnpm refuses to install with an engine outside `engines`.
- Versions of tooling shared by several packages (TypeScript, ESLint, Vitest) are declared once in the `catalog` of `pnpm-workspace.yaml` and referenced as `catalog:` from each package.
- Apps and packages extend a configuration from `packages/tsconfig`: `library.json` for packages, `nextjs.json` for the frontend, `nestjs.json` for the backend. All of them build on `base.json`, which turns on strict mode.

## Frontend (apps/web)

- Next.js with the App Router and TypeScript strict mode, extending `packages/tsconfig/nextjs.json`. Pages live under `src/app`.
- `pnpm --filter web dev` serves the app; `next build` produces the output that `next start` and the end-to-end tests run against.
- Unit and component tests run on Vitest with a jsdom environment and Testing Library, next to the code as `*.test.tsx`. CSS Modules keep their authored class names under Vitest (`classNameStrategy: "non-scoped"`), so a test can assert on them.
- Linting combines the shared configuration with the Next.js plugin (`core-web-vitals`), the React Hooks plugin, and the app's own `atomic-design/no-upward-stage-imports` rule under `apps/web/eslint/`.
- Manrope is loaded once with `next/font/google` (weights 400 to 800) in the root layout and exposed as `--font-manrope`; the design tokens from the Account design (palette, type scale, spacing, radii, focus ring, transitions, layout widths) are CSS custom properties in `globals.css`, declared once and read by every component.
- Pages follow the application flow: sign up and sign in, then the journey (upload resume, LinkedIn URL, profile page, job description, analysis, resume recommendations, study recommendations, mock interview, summary).
- Because steps are sequential (TC-06), the UI exposes a step as available only when the backend reports the previous step complete. The UI never decides step order on its own.
- Profile-building progress (TC-04) is shown as a percentage, driven by backend state.

### Components follow atomic design (ADR-0015)

Shared components live under `src/components`, in one folder per stage of [atomic design](https://atomicdesign.bradfrost.com/chapter-2/); pages are the `page.tsx` files under `src/app`:

```
apps/web/src/
├── app/                      pages: page.tsx with real content, route groups and layout.tsx
│   ├── layout.tsx            root: the Manrope font variable and globals.css, nothing visible
│   ├── (site)/               home and journey under the site header
│   └── (account)/            sign in and sign up inside the account template
└── components/
    ├── atoms/                button, text input, select, label, eyebrow, hint, error message, progress bar, badge, logo mark, code box
    ├── molecules/            field; code input; phone field; verified email field; labelled divider; screen heading; resend countdown
    ├── organisms/            brand panel; email form; code form; identity form; done card
    └── templates/            account template: brand panel beside the centred form column, panel hidden below 900px
```

- A stage imports only from the stages below it: atoms import nothing under `components/`, molecules import atoms, organisms import molecules and atoms, templates import organisms and below. Only pages touch the API client, the Session, and server actions; components receive what they need as props. The `atomic-design/no-upward-stage-imports` rule in `apps/web/eslint/` fails the lint on an import that goes up a stage, sideways to another component of the same stage, or into `src/app`; a component may still import its own folder, `src/lib`, packages, and libraries.
- A route group `layout.tsx` renders a template from `components/templates/`, so the template is a plain component that Vitest renders without the router. Frost's template is not the App Router's reserved `template.tsx`. The `(account)` layout renders `AccountTemplate`; the `(site)` layout renders the header for the home and journey pages, so the root layout stays empty and the brand panel can fill the viewport.
- One folder per component, kebab-case, with the component and its test inside: `components/molecules/code-input/code-input.tsx` and `code-input.test.tsx`. Imports use the full path to the file; there are no barrel `index.ts` files.
- `"use client"` sits on the lowest stage that needs browser state. Design tokens are CSS custom properties in `globals.css`, not components.
- The design pages in the [GitHub Wiki](https://github.com/braydevkin/helpmegethired/wiki) list the components of each screen by stage, and the review checks the tree against that list.

### Account pages and the Session cookie (FR-01)

Sign in and sign up are passwordless (ADR-0017). Auth.js runs the one-time code flow inside the web app, and the web app is the only client of the API, talking to it from the server side, so the browser never handles the Session token:

- `/sign-in` renders `SignInFlow`, a client component next to the page that switches between the `EmailForm` and `CodeForm` organisms and passes the server actions down. `EmailForm` parses the field with `SendCodeSchema` from `packages/shared` before anything is sent, and `sendCodeAction` asks Auth.js to send a code to that email. `CodeForm` parses `VerifyCodeSchema` from its six digit boxes; `signInWithCodeAction` verifies the code in-process, then redirects to `/journey`, or to `/sign-up` when the Account has no name yet (open point 8), or answers with one message for a wrong, expired, or used code, shown under the boxes. "Change email" returns to the first step with the email kept; the resend link is a 60 second countdown that sends a new code when it ends.
- `/sign-up` renders `SignUpFlow` with the same two organisms under a three-step progress bar, then `IdentityForm` (name, last name, the verified email read-only with its badge, phone with the dial code select showing the ISO country as text, optional address with its hint; no Terms sentence until the documents exist) and `DoneCard` ("You're in, {name}", "Go to my dashboard" to `/journey`). `verifyCodeAction` opens the Session and stays on the page; `saveAccountInformationAction` parses `AccountInformationSchema` and calls `PATCH /auth/account`. `signUpStart` picks the first step on the server: a Session without a name means step 3, a pending email means step 2, otherwise step 1.
- `sendCodeAction` remembers the email in the `pending-email` cookie (HTTP-only, `SameSite=Lax`, living as long as the code) so a reload of the code step keeps it; verifying the code deletes the cookie (open point 11).
- `src/auth` holds the Auth.js setup: `authRuntime()` builds the configuration on first use from `AUTH_SECRET` and `DATABASE_URL` (validated by `readAuthEnvironment`), the `email-code` provider generates 6-digit codes with a 10 minute expiry, `AccountAdapter` maps Auth.js onto `accounts`, `sessions`, and `verification_tokens` through Kysely, and `one-time-code.ts` exposes `sendCode` and `verifyCode`. There is no `/api/auth/*` route: both steps are server actions.
- Delivery goes through the `CodeSender` abstraction (ADR-0018). With `AUTH_RESEND_KEY` set, `ResendCodeSender` posts the email rendered by `renderCodeEmail` (plain text and HTML, the design tokens inlined, no embedded font) to Resend's HTTP API from the address in `EMAIL_FROM`. Without the key the `DevelopmentCodeSender` logs the code and keeps the last one per email, readable at `GET /development/verification-code?email=` outside production so the end-to-end tests can finish the flow; a production configuration without the key refuses to start with a message naming the two variables.
- A verified code opens a database Session of 12 hours whose token Auth.js stores in the cookie named `session`: HTTP-only, `SameSite=Lax`, `Path=/`, `Secure` in production, expiring with the Session. The adapter stores only the SHA-256 hash of the token in `sessions.token_hash`, which is what the API validates. Server components and actions read the cookie with `readSessionToken()` and send it to the API as `Authorization: Bearer`.
- `/journey` is the first authenticated page. It asks the API for the Account behind the cookie and redirects to `/sign-in` when the API no longer accepts the token. Sign out is a server action that deletes the Session at the API, clears the cookie, and redirects to `/sign-in`.
- `src/proxy.ts` handles the redirects before a page renders: an authenticated path without the cookie goes to `/sign-in`; with a cookie the proxy asks the API for the Account: a stale token is cleared (and an authenticated path goes to `/sign-in`), an Account without a name is sent to `/sign-up` from every other path so the account information step is finished first, and a complete Account is sent from the forms to `/journey`.
- The API origin comes from `API_URL`, read on the server only, defaulting to `http://localhost:3001` for a native `next dev`. The compose stack sets it to `http://api:3001` and gives the web app the same `DATABASE_URL` as the API. The variables are listed in `apps/web/.env.example`.

## Backend (apps/api)

- NestJS modules mirror the domain:
  - `auth` (Account, authorization)
  - `profile` (the seven Profile parts, `GET /profile`, confirmation)
  - `resumes` (Uploaded Resume, its state machine, the four resume routes)
  - `storage` (the `ObjectStorage` abstraction over the S3 clients)
  - `parser` (rule-based extraction of Profile parts from text; pure functions)
  - `ingestion` (Ingestion, Segments, Steps, the Segment processors)
  - `queue` (the BullMQ connection and the two queues)
  - `job-descriptions` (store, embed)
  - `analysis` (the sequential AI pipeline)
  - `learnings` (store, study plans)
  - `interview` (mock interview)
- Authorization is enforced at the module boundary. A Candidate can only read and write their own entities, and the rule is structural, not a check added per route:
  - Every repository method that reads or changes a Candidate-owned row takes the `accountId` first and filters by it (`where account_id = ...`, or through the owning row for a table such as `ingestion_segments` that has no `account_id` of its own). A row of another Account answers as not found, never as forbidden, so an id is never confirmed to exist. Services and controllers pass the Account from `@CurrentAccount()`.
  - The queue is the one exception. Code that acts on behalf of a job, not a Candidate, lives in a repository named for it (`IngestionRunRepository` for the runner and worker) and addresses rows by id alone. A Candidate-facing service never injects such a repository.
  - Review rule: a pull request that adds a query on an owned table without the Account filter, or that gives a Candidate-facing service an unscoped repository, is not merged. The two-Account helper under [Testing](#testing) is how the tests prove it.
- Configuration comes from environment variables, validated at startup by a Zod schema in `apps/api/src/config`. A missing or invalid variable stops the process with a message naming the variable. The variables and their defaults are listed in `apps/api/.env.example`.
- `GET /health` reports the application status. Its response shape is `HealthStatusSchema` in `packages/shared`, so the web app and the end-to-end tests validate it against the same contract.
- Tests live next to the code: `*.test.ts` files are unit tests (`pnpm test`), `*.integration.test.ts` files boot the application against a real database (`pnpm test:integration`, see [Testing](#testing)).

### Authentication (FR-01)

The `auth` module guards the API with the Session that Auth.js opens in the web app (ADR-0017) and owns the Account information:

- `SessionGuard` is registered globally, so every route requires `Authorization: Bearer <token>` unless its handler or controller carries `@Public()`. The guard hashes the token with SHA-256 and looks it up in `sessions.token_hash` with its expiry, the same row the web app's adapter wrote, so nothing is issued twice. Handlers receive the signed-in Account through `@CurrentAccount()`.
- `GET /auth/account` returns the Account behind the token: email, name, last name, phone, address, and creation time, with `null` for information not yet given. `PATCH /auth/account` takes `AccountInformationSchema` and stores name, last name, phone with its dial code, and the optional address, answering the updated Account. `POST /auth/sign-out` deletes the Session row.
- The API sends no codes and creates no Accounts: Auth.js creates the Account on the first verified code. The API's `AccountRepository` creates Accounts only for its own tests.
- Request bodies are validated with the shared Zod schemas through `ZodValidationPipe`. A failed validation answers `400` with `ApiErrorSchema`, whose `issues` name the fields without echoing the values.

### Database access

The database layer lives in `apps/api/src/database` and follows ADR-0012:

- `database.schema.ts` declares every table as a Kysely interface. Table and column names follow [CONTEXT.md](../CONTEXT.md) in `snake_case`.
- `DatabaseModule` is global. It builds one `Kysely` instance from `DATABASE_URL`, exposes it through the `DATABASE` token, and closes the pool on shutdown.
- Repositories (for example `AccountRepository` in `auth`) are the only classes that query. They map rows to the types from `packages/shared`, so services and controllers never see column names.
- `migrations/` holds one TypeScript module per migration with `up` and `down`, registered in `migrations/index.ts`. `migrator.ts` wraps Kysely's `Migrator`; `migrate.cli.ts` is the command behind `pnpm db:migrate` and `pnpm db:migrate:down`, which Turbo runs after building the API and its workspace dependencies. The first migration enables the `vector` extension and creates `accounts`; the second adds the password hash and creates `sessions`; the third creates `ingestions` and `ingestion_segments`; the fourth drops the password hash, adds the Account information and the email verification time to `accounts`, and creates `verification_tokens` for the one-time codes.

### Profile ingestion (TC-03, TC-04, TC-05)

Profile building is an **Ingestion**: one run for one Account from one source, split into ordered **Segments**, each of which goes through three **Steps**. The vocabulary is in [CONTEXT.md](../CONTEXT.md); the queue decision is ADR-0020. The `ingestion` module holds the state machine and its persistence; the resume Segment processors are described under [Resume upload and extraction](#resume-upload-and-extraction-fr-02-tc-01), the LinkedIn ones arrive with their own milestone.

```
start ──▶ ingestions (queued) + ingestion_segments (pending), one transaction
                                                          │ after commit
                                       profile-ingestion job, id = ingestion id
                                                                    │
                          worker: run(ingestionId) ◀────────────────┘
                                   │
                  for each Segment not yet saved, from its last completed Step:
                     read ──▶ recognize ──▶ save        (each Step persisted as it completes)
                                   │
                  all saved ──▶ completed
                  a Step throws ──▶ Segment keeps its last completed Step + error
                                    Ingestion: attempts < max ? queued (BullMQ retries) : failed
```

**Ingestion states.** `queued` (waiting for a worker, on the first attempt or after a failed one), `running` (a worker is processing it), `failed` (every attempt used; the Candidate may start a new Ingestion), `completed`. The worker increments `attempts` in the same write that moves the row to `running`, before any Step runs, so an attempt that dies without reporting (a crash, an out-of-memory kill) still counts. `max_attempts` (3) is stored on the row and sent to BullMQ as the job's attempts, so the queue and the row agree; a run that finds `attempts` already at `max_attempts` marks the Ingestion `failed` instead of executing.

**Segment states.** A Segment's status is the last Step it completed: `pending`, `read`, `recognized`, `saved`. The output of `read` and `recognize` is persisted on the Segment (`content`, `recognized`) so a retry continues with the next Step instead of recomputing. A Step that throws records the message on the Segment (`last_error`) and stops the run; the Segment's status does not move.

**Resuming.** A retry calls the same `run(ingestionId)`. The runner walks the Segments in `position` order, skips the ones already `saved`, and for the others executes only the Steps after the persisted status. Nothing already completed is redone.

**Progress.** `progressOf(ingestionId)` reads the Ingestion status and the status of every Segment and answers `IngestionProgressSchema`: the percentage is `floor(100 × completed Steps ÷ (3 × Segments))`, plus the total and saved Segment counts. Nothing in memory contributes; a fresh process answers the same number.

**One active Ingestion per Account.** The partial unique index `ingestions_one_active_per_account_idx` on `account_id where status in ('queued', 'running')` enforces it in the database. `start` inserts the Ingestion and its Segments in one transaction and maps the unique violation to `IngestionAlreadyActiveError`; the job is added after the commit, with the Ingestion id as job id. If the enqueue fails, the row stays `queued` and the [reconciliation job](#reconciliation) enqueues it on its next run. A `completed` or `failed` Ingestion frees the Account. A worker that dies stops renewing the job's lock; BullMQ marks the job stalled and re-delivers it, and the next attempt resumes from the first incomplete Segment. Because the dead run had already incremented `attempts`, the re-delivery is counted, and an Ingestion whose runs keep dying reaches `max_attempts` and becomes `failed`, which frees the Account instead of locking it behind endless resets.

**Processors.** A `SegmentProcessor` implements `read`, `recognize`, and `save` for one Segment `kind`; the `SegmentProcessorRegistry` resolves the processor by kind. The resume kinds are listed under [Segments from sections](#segments-from-sections); the tests keep a scripted processor for the state machine.

**Queue.** `IngestionQueue` is the abstraction (`enqueue`, `work`); `BullMqIngestionQueue` implements it on the `profile-ingestion` queue with exponential backoff between retries and failed jobs kept for inspection. The `QueueModule` provides the BullMQ connection from `REDIS_URL` and registers the two queues; only the [worker](#the-worker) registers processors.

### Resume upload and extraction (FR-02, TC-01)

The Candidate uploads a PDF, the platform extracts its text once, and an Ingestion builds the Profile from that text. The screens are [Design: Resume Upload](https://github.com/braydevkin/helpmegethired/wiki/Design-Resume-Upload) and [Design: Profile](https://github.com/braydevkin/helpmegethired/wiki/Design-Profile) on the wiki; the maintainer's upload lane is `design/resume/system-design.png` there, from `arch/helpmegethired-architecture.drawio`. The decisions are ADR-0020 (queues and worker) and ADR-0021 (object storage); the limits and error codes are fixed by #52. The terms (Uploaded Resume, Ingestion, Segment, Step, Progress, the seven Profile parts, Confidence) are in [CONTEXT.md](../CONTEXT.md).

```
browser                 api                    object store          redis            worker                    postgres
  │ POST /resumes ──────▶│ uploaded_resumes: pending ──────────────────────────────────────────────────────────────▶│
  │◀── presigned PUT ────│                                                                                          │
  │ PUT bytes ───────────────────────────────▶│ resumes/{account}/{id}.pdf                                          │
  │ POST /resumes/:id/complete ▶│ HeadObject ─▶│                                                                     │
  │                      │ uploaded ─────────────────────────────────────────────────────────────────────────────▶│
  │                      │ resume-extraction job ───────────────────▶│                                             │
  │                      │                                           │──▶│ processing, validate, pdftotext          │
  │                      │                        GetObject ◀────────────│ raw text + extractor version ──────────▶│
  │                      │                        DeleteObject ◀─────────│                                          │
  │                      │                                           │◀──│ ingestion + segments ──────────────────▶│
  │                      │                                           │──▶│ profile-ingestion job: read, recognize, save per Segment ▶│
  │ GET /resumes/:id (poll, ETag) ▶│                                     │ done ──────────────────────────────────▶│
  │ GET /profile ────────▶│                                                                                          │
```

#### Uploaded Resume state machine

| From | To | Written by | When |
| --- | --- | --- | --- |
| — | `pending` | API, `POST /resumes` | The record and the presigned URL are created |
| `pending` | `uploaded` | API, `POST /resumes/:id/complete`, or the reconciliation job | The object exists with the declared size (`complete` heads it up to three times, 500 ms apart, before giving up); the `resume-extraction` job is added with the record id as job id |
| `pending` | `expired` | Reconciliation job | No object after 24 hours |
| `uploaded` | `processing` | Worker | The extraction job starts |
| `processing` | `uploaded` | Reconciliation job | The record is stale, no job is active, and `attempts` is below `max_attempts`; it is re-enqueued |
| `processing` | `failed` | Worker, or the reconciliation job | Validation or extraction refuses the file, the Ingestion exhausts its attempts, or a stale record has no attempt left |
| `processing` | `done` | Worker | The Ingestion created from the text has completed |

`done` means the Profile is saved, not only the text extracted: the record stays `processing` while the Ingestion runs, and the upload page derives its "Building your profile" stage from the Ingestion's Progress. A `failed` record carries one error code, which the page turns into a message: `not_pdf`, `too_large`, `too_many_pages`, `encrypted_pdf`, `corrupt_pdf`, `scanned_pdf`, `upload_incomplete`, `extraction_failed` (retries exhausted on a transient error), and `profile_build_failed` (the Ingestion exhausted its attempts). `POST /resumes` never refuses a new upload; `complete` answers `409 ingestion_active` while the Account has another record `uploaded` or `processing` or an active Ingestion (TC-05). Uploading the same bytes twice (same Account, same SHA-256) answers the existing record and creates no second job.

#### The two queues

| Queue | One job per | Job id | Producer | Consumer |
| --- | --- | --- | --- | --- |
| `resume-extraction` | Uploaded Resume | the record id | `complete`, or the reconciliation job | the extraction processor on the worker |
| `profile-ingestion` | Ingestion | the Ingestion id | the extraction processor, after it creates the Ingestion | the Ingestion runner on the worker |

The job id equal to the record id makes every add idempotent, and every processor begins by reading what is already persisted and skipping it, so a re-delivery after a crash, a stalled lock, or a reconciliation run never repeats work. Both rows carry `attempts` and `max_attempts`; the processor increments `attempts` in the write that marks the row `processing` or `running`, before doing any work, so a run killed without reporting still counts and the reconciliation job never re-enqueues past the limit. Backoff is exponential, and failed jobs are kept so the queue dashboard shows them. The enqueue always happens after the PostgreSQL transaction commits; an enqueue failure is logged and left to the reconciliation job, never surfaced as a request error.

#### The worker

`apps/api/src/worker.ts` is a second Nest entrypoint (`createApplicationContext(WorkerModule)`) that hosts every processor: extraction, the Ingestion runner, and the reconciliation job. It runs with `WORKER_CONCURRENCY` jobs at a time (default 4), renews the lock of every active job, and closes both queues on `SIGTERM`. The `worker` compose service is built from the API image with the same environment as `api`, no port, and a memory limit, so a hostile PDF can exhaust the worker and never the API. The API process registers no processor.

#### Extraction

The extraction processor takes an `uploaded` record, marks it `processing` and increments its `attempts` in one write, and streams the object from storage:

1. **Validation of what storage could not check**: magic bytes (`%PDF-`), size at most 5 MB, page count at most 20, and no encryption. Each failure is unrecoverable: the record becomes `failed` with its code and the object is deleted.
2. **Text extraction** with `pdftotext -layout` from poppler as a child process fed by the stream, killed after `EXTRACTION_TIMEOUT_MS` (default 30 s); exit codes map to `corrupt_pdf` and `encrypted_pdf`. `pdfjs-dist` is the fallback when poppler is unavailable or fails transiently. No network access.
3. **Scanned detection**: fewer than 200 non-blank characters on a file over 50 KB is `scanned_pdf`. OCR is out of this phase.
4. **The raw text and the extractor version are saved on the record first**, then the object is deleted. A job re-delivered after this point never runs `pdftotext` again, and a later extractor or an LLM extraction reads the stored text, never the PDF.
5. **Hand over**: the section splitter creates the Segments, the Ingestion is inserted, and its job is added.

Storage or database errors and timeouts retry with backoff up to the row's `max_attempts`, then end in `failed` with `extraction_failed`. The extractor runs only on the worker; the API image ships poppler because both services share it.

#### Segments from sections

The section splitter (parser foundation) cuts the text into blocks, and each block becomes one Segment, in this order: `header` (headline, summary, LinkedIn URL, GitHub URL), one `experience` per Experience block, `education`, one `project` per Project block, `skills`, `languages`, `certifications`. A section the résumé lacks produces no Segment. Each kind has a `SegmentProcessor`: `read` returns the Segment's slice of the text, `recognize` runs the parser layer for that kind, and `save` writes typed rows tagged with the source Ingestion. The upload page's Profile data checklist ticks along these kinds as their `save` Steps complete.

The header processor reads the name, e-mail, and phone only to find where the header ends and to compare them with the Account; a mismatch is recorded as a review flag. They are never written into a Profile table.

#### Replace by source Ingestion

Every Profile row records the Ingestion that wrote it. The Profile reads the rows of the latest completed Ingestion per source (Uploaded Resume, later LinkedIn). When an Ingestion completes, the rows written by earlier Ingestions of the same source are deleted, the review flags are cleared, and the confirmation is reset. A re-upload that fails leaves the previous Profile untouched, and the Candidate never sees a half-built Profile. A resume Ingestion never touches rows from another source; how two sources merge the Basic Profile is decided with the LinkedIn milestone.

#### Reconciliation

A BullMQ repeatable job on the worker, every 5 minutes with a fixed repeat key so one instance exists however many workers run. It is what makes the state machine converge without a transactional enqueue:

| Rule | Condition | Action |
| --- | --- | --- |
| Promote a silent upload | `pending` older than 2 minutes and the object is present with the declared size | `uploaded`, extraction job added (the same path as `complete`) |
| Expire | `pending` older than 24 hours with no object | `expired` |
| Re-enqueue an orphan | `uploaded` with no waiting or active job | extraction job added |
| Reset a stale run | `processing` older than `STALE_PROCESSING_MINUTES` (default 10) with no active job; an Ingestion `queued` or `running` with no job likewise | back to `uploaded` and re-enqueued while `attempts` is below `max_attempts`, otherwise `failed` with `extraction_failed`; the Ingestion re-enqueued under the same rule, otherwise `failed` and its record `failed` with `profile_build_failed` |
| Clean the bucket | an object whose record is `expired` or `failed`, or that has no record, older than 7 days | deleted |

Every action writes one structured log line without Candidate data.

#### Parser layers

The parser is pure functions in `apps/api/src/parser`, independent of the queue and the database, applied in layers to the stored text. Every recognised field carries a Confidence (`high`, `medium`, `low`); `low` is what the Profile page flags for review.

| Layer | What it does |
| --- | --- |
| Cleaning | Normalised line endings, collapsed blank lines, page numbers removed, hyphenated line breaks joined, bullet glyphs stripped |
| Contact | E-mail, phone, LinkedIn, GitHub, and other URLs over the full text (`high`); the name line heuristic (`medium`). Used for the header boundary and the Account comparison only |
| Section splitting | A Portuguese and English header dictionary (experience, education, skills, projects, summary, languages, certifications), accent-insensitive, with a header score (dictionary match, all caps, short line, followed by a blank line; threshold 3). The text before the first header is the header section |
| Experiences | Date range detection in both languages, including open endings; a matching line starts an entry. Title and company split on the usual separators with a job title dictionary deciding which side is the title (`high`), both kept raw otherwise (`low`). Career months from the periods with overlaps merged, open ranges ending today; exposed as a pure function `GET /profile` reuses for the years of experience |
| Education | Entries by the date range rule; institution and degree split by a degree dictionary, Confidence per field |
| Skills | A technology dictionary of about 300 terms with canonical names, synonyms, and a category (`Languages & runtimes`, `Frameworks & data`, `Infrastructure`, `Other`), matched over the full text and deduplicated; a term found inside an Experience or Project is also attached to it |
| Projects | Entries by the date range rule or a name line followed by description lines; name, description, link, matched skills |
| Languages | One entry per line with the level when a known level word or CEFR code appears (`medium`) |
| Certifications | One entry per line: name, issuer, year when present (`medium`) |

The output is `ProfileDraftSchema` in `packages/shared`: the seven parts, each field wrapped with its value and Confidence, and the parser version. Two-column layouts regrouped by coordinates are a follow-up.

#### Synthetic corpus

Parser quality is measured against a corpus of résumés with expected output, and a rule change that regresses another case is caught by a snapshot. The corpus holds no real person's data: fictional people and companies rendered through HTML templates to PDF with Playwright's Chromium, in several layouts (single column, two columns, Canva-like, LaTeX-like, LinkedIn export), in Portuguese and English, with the PDF, its extracted text, and its expected JSON committed under `apps/api/test/fixtures/resumes`. The milestone target is thirty résumés. A rule change updates the snapshots deliberately in the same pull request; a real résumé is never committed. Beside it sits the set of hostile PDFs from #52 that the extraction tests feed the worker.

#### Client contract

Every route is Candidate-owned: another Account's id answers `404` everywhere. Schemas live in `packages/shared` (`UploadedResumeSchema`, `ResumeUploadSchema`, `ProfileSchema`, and the error codes).

| Route | Answers |
| --- | --- |
| `POST /resumes` (file name, size, SHA-256, content type) | `201` with the record, the presigned `PUT` URL, and its expiry; `200` with the existing record when the same bytes are already `uploaded`, `processing`, or `done`; a `pending` duplicate gets a fresh URL |
| `POST /resumes/:id/complete` | `202` and the record `uploaded`; `409 upload_incomplete` when the object is still missing after three `HeadObject` calls 500 ms apart, or when its size differs, in which case the record stays `pending` and the reconciliation job promotes it once the object is visible; `409 ingestion_active` while another upload or Ingestion is active; idempotent for a record no longer `pending` |
| `GET /resumes/:id` | The record with its status, error code, and the Ingestion Progress when it exists; an `ETag` from status, error, and Progress, `304` on `If-None-Match`, so the page can poll cheaply |
| `GET /resumes` | The Account's records, newest first, optional status filter |
| `GET /profile` | The seven Profile parts, the source Uploaded Resume, the review flags, and the derived years of experience |
| `POST /profile/confirm` | Clears the review flags and records the confirmation time; idempotent |

The upload page composes its single percentage from the byte progress of the `PUT` (0 to 25), the record status (`uploaded` 25, `processing` 30), and the Ingestion Progress mapped onto 30 to 100. Nothing on the page comes from a timer.

### AI pipeline (TC-06, TC-07)

LangChain orchestrates tool calls. Each tool wraps a NestJS service (the business logic). The pipeline for one job description:

```
Job Description
   │
   ▼  RAG: retrieve relevant profile chunks + JD chunks from pgvector
Resume ATS Level ──── score 0–10
   │
   ▼  (only if score < 8)
Resume Builder ─────── updated resume from experiences, projects, basic profile
   │
   ▼  RAG: previous applications
Learning with job applications ── what to learn
   │
   ▼
Learn with AI ──────── structured study plan
   │
   ▼
Apply Helper ───────── cover letter + resume + study plan
   │
   ▼
Mock Interview
   │
   ▼
Preparation summary with success rates
```

- Each layer persists its output before the next starts. The pipeline state is what tells the frontend which step is available.
- Every layer calls RAG first and passes only retrieved context to the LLM, never the full profile.
- The LLM provider is configured behind LangChain and is not referenced directly by services.

## Data (PostgreSQL + pgvector)

One database serves both relational data and vector search.

- Relational tables for Account, Session, One-Time Code, Uploaded Resume, Ingestion, Segment, the seven Profile parts, Job Descriptions, Learnings, and pipeline runs. Tables arrive with the task that needs them, each through a migration; `accounts`, `sessions`, `verification_tokens`, `ingestions`, and `ingestion_segments` are the first, `uploaded_resumes` and the Profile tables follow with the upload milestone. Every Profile row carries `account_id` and `source_ingestion_id`. The job queue lives in Redis (ADR-0020), and the PDF bytes in the object store (ADR-0021), never in PostgreSQL.
- The `vector` extension is enabled by the first migration, so every later migration can declare embedding columns.
- Embeddings stored in pgvector columns alongside the rows they describe (profile chunks, job description chunks, learnings).
- RAG queries are scoped by Account id. Retrieval across Accounts is never performed.

## Testing

| Level | Tool | Where |
| --- | --- | --- |
| Unit | Vitest | Next to the code in each app and package |
| Integration | Vitest | `apps/api` against the compose PostgreSQL, Redis, and object store, one isolated database per run; `apps/web` for the Auth.js adapter against the migrated database in `DATABASE_URL` |
| End-to-end | Playwright | `e2e/`, a workspace package; against the built web app locally, against the full stack in Docker Compose in CI |

`apps/api/src/database/testing/account-pair.ts` is the helper every module with Candidate-owned rows uses: `createAccountPair` inserts two Accounts, and `expectScopedToAccount` runs a lookup as the owner, which must answer, and as the other Account, which must answer `undefined` or throw a `*NotFoundError`. A new owned table adds one such assertion per read and write.

Integration tests need the compose `postgres`, `redis`, and `storage` services and the API's `DATABASE_URL`, `REDIS_URL`, and `S3_*` variables: `pnpm test:integration` reads them from the environment or from `apps/api/.env`. The parser's snapshot suite is unit level and runs without Docker. The API's Vitest global setup creates a database named `helpmegethired_test_<id>` on that server, migrates it to the latest version, hands its URL to the test workers, and drops it when the run ends. Test files run one at a time because they share that database. The migration test reverts and reapplies the last migration, so every migration must have a working `down`. The web app's integration project runs the Auth.js adapter against the database `DATABASE_URL` names, which must already be migrated (`pnpm db:migrate`), as CI does before the integration job.

The `e2e` package depends on `@helpmegethired/web`, so `pnpm turbo run test:e2e` builds the web app first and Playwright starts it with `next start` on port 3100. Setting `E2E_BASE_URL` points the tests at an already running stack instead. Browsers are installed once with `pnpm --filter e2e exec playwright install chromium`.

## Local runtime

Docker Compose runs the whole monorepo. `docker compose up` brings up the long-running services and two one-shot steps from the root `docker-compose.yml`. CI uses the same compose file for integration and end-to-end tests. The queue (ADR-0020), the object store (ADR-0021), the worker, and their two dashboards arrive with #72 and #73; until then the stack is the first four rows.

| Service | Image | Host port (default) | Health check |
| --- | --- | --- | --- |
| `web` | `docker/web/Dockerfile`, target `development` | `WEB_PORT` (3000) | `GET /` answers |
| `api` | `docker/api/Dockerfile`, target `development` | `API_PORT` (3001) | `GET /health` answers |
| `migrate` | same image as `api`, runs `pnpm db:migrate` and exits | none | exit code 0 |
| `postgres` | `pgvector/pgvector:pg17` | `POSTGRES_PORT` (5432) | `pg_isready` |
| `redis` | `redis:8-alpine`, `--maxmemory-policy noeviction`, append-only persistence | `REDIS_PORT` (6379) | `redis-cli ping` |
| `worker` | same image as `api`, runs `pnpm --filter api dev:worker`, memory limit | none | the process is alive and both queues are connected |
| `storage` | `rustfs/rustfs`, S3 API on 9000 and the console on 9001 | `STORAGE_PORT` (9000), `STORAGE_CONSOLE_PORT` (9001) | the S3 health endpoint answers |
| `storage-init` | the S3 client image, creates the private `resumes` bucket with its CORS and exits | none | exit code 0 |
| `queue-dashboard` | `ghcr.io/felixmosh/bull-board`, pointed at `redis` | `QUEUE_DASHBOARD_PORT` (3002) | `GET /` answers |

The two dashboards are development tools: the queue dashboard shows every job of both queues with its attempts and failures, and the storage console shows the bucket. Neither is part of a deployed environment.

- Configuration comes from a root `.env`, copied from `.env.example`. Every variable is required except `AUTH_RESEND_KEY` and `EMAIL_FROM`, which are blank by default: a missing required one stops `docker compose` with a message naming it. Inside the network the services keep fixed ports (`api:3001`, `web:3000`, `postgres:5432`); the `.env` variables only choose the host ports.
- The `api`, `worker`, and `migrate` containers receive `PORT`, `WEB_ORIGIN`, `DATABASE_URL`, `REDIS_URL`, and the `S3_*` variables from the compose file, so `apps/api/.env.example` is only needed when the API runs natively. Inside the network the database URL points at `postgres:5432`, the Redis URL at `redis:6379`, and `S3_ENDPOINT` at `storage:9000`; from the host they point at `localhost` with the `.env` ports. `S3_PUBLIC_ENDPOINT` is always the host address, because it is embedded in the presigned URL the browser uses.
- The `web` container receives `API_URL=http://api:3001` and starts only after `api` is healthy. When the web app runs natively, `API_URL` defaults to `http://localhost:3001`.
- The stack sends no real email. `web` receives `AUTH_RESEND_KEY` and `EMAIL_FROM` from `.env`, blank by default, so the code is printed in its logs and read from the development route; setting both in `.env` switches the local stack to Resend for a real delivery check.
- Both Dockerfiles build from the repository root: they install the workspace with pnpm filtered to the app and its workspace dependencies, build those dependencies (`packages/shared`), and run the app's `dev` script as the unprivileged `node` user. The `development` target is the only one for now; production images are a separate task.
- Hot reload: `apps/web/src` and `apps/api/src` are bind-mounted into the containers, so `next dev` and `nest start --watch` pick up edits without a rebuild. A change to dependencies, to a file outside `src`, or to `packages/shared` needs `docker compose up --build`.
- `migrate` starts once `postgres` is healthy and applies the pending migrations; `api` starts only after `migrate` has exited successfully. `docker compose up --wait` returns zero once every health check passes, which makes it the smoke test of the stack.
- Data lives in the `postgres-data` volume and survives `docker compose down`; `docker compose down --volumes` resets it. The `vector` extension ships with the image and is enabled per database by the first migration.

## CI/CD

GitHub Actions, following the Gitflow model in [workflow.md](workflow.md). Workflows live in `.github/workflows`; the steps they share (pinned Node and pnpm, `pnpm install --frozen-lockfile`, starting the compose `postgres`, `redis`, and `storage`) are composite actions under `.github/actions`.

Every workflow declares the `GITHUB_TOKEN` permissions it needs at workflow level, and no more: `CI` and `Release document` only read the repository (`contents: read`), and `Board` grants the workflow token nothing (`permissions: {}`) because it acts through `PROJECT_TOKEN`. CodeQL flags a workflow that leaves the default permissions in place.

- **`CI` on every pull request to `develop` or `main`**: five checks, one job each, so a failure names the level that broke.

  | Check | Command | Needs |
  | --- | --- | --- |
  | `lint` | `pnpm lint` | |
  | `typecheck` | `pnpm typecheck` | |
  | `unit` | `pnpm test` | |
  | `integration` | `pnpm db:migrate`, `pnpm db:migrate:down`, `pnpm db:migrate`, then `pnpm test:integration` | compose `postgres`, `redis`, and `storage` started from `.env.example`; poppler on the runner |
  | `e2e` | `pnpm --filter e2e test:e2e` with `E2E_BASE_URL` pointing at the stack | `docker compose up --build --wait` from `.env.example` |

  `.env.example` is the configuration in CI, so it must stay complete and valid. A new run for the same pull request cancels the previous one.
- **`Release document` on every pull request to `main`**: fails unless the pull request adds or changes a `docs/releases/vX.Y.Z.md`.
- **`Codacy Static Code Analysis` on every pull request and on every push to `develop` and `main`** ([ADR-0016](adr/0016-codacy-static-analysis.md)): Codacy Cloud analyses the commit in its own cloud, triggered by the repository webhook, and reports the result as a commit status. No workflow, secret, or CI minute is involved, so the check also runs on pull requests from forks. It fails when the pull request introduces at least one new issue (the organisation's default `Codacy Gate Policy`); complexity, duplication, and coverage are reported but do not gate.

  | Tool | Looks at | Configuration |
  | --- | --- | --- |
  | ESLint 9 | TypeScript and JavaScript | The repository's `eslint.config.*` files, so the findings match `pnpm lint` |
  | Opengrep | Security and secrets, every language (Semgrep rules) | Codacy defaults minus two patterns; `*.test.ts`, `*.test.tsx`, `e2e/`, and `apps/api/test/` (fixtures and their generators) excluded in `.codacy.yml` because fixtures hold literal passwords and legacy ciphers |
  | Trivy | Vulnerable dependencies | Codacy defaults |
  | Checkov | Docker Compose and GitHub Actions | Codacy defaults |
  | Hadolint | Dockerfiles | Codacy defaults |
  | Lizard | Function length and cyclomatic complexity | Codacy defaults |
  | PMD 7 | JavaScript | Codacy defaults |
  | Stylelint | CSS | Codacy defaults minus the SCSS-only patterns |
  | markdownlint | Markdown | Codacy defaults |
  | Spectral | OpenAPI documents | Codacy defaults |
  | Jackson Linter | JSON | Codacy defaults |

  `.codacy.yml` at the root holds what the repository can express itself: paths excluded from every tool (`arch/`, build output) and the per-tool exclusions. `pnpm-lock.yaml` is excluded from Lizard only, so its length is not a finding while Trivy still reads it to resolve the exact dependency versions. Five settings live in Codacy and are reproduced with the Codacy Cloud CLI from a clone of the repository:

  ```sh
  codacy tool Agentlinter --disable
  codacy pattern Stylelint Stylelint_scss_function-disallowed-list --disable
  codacy pattern Stylelint Stylelint_scss_selector-class-pattern --disable
  codacy pattern Opengrep Semgrep_json.npm.security.package-dependencies-check.package-dependencies-check --disable
  codacy pattern Opengrep Semgrep_generic.secrets.gitleaks.hashicorp-tf-password.hashicorp-tf-password --disable
  ```

  Agentlinter grades `CLAUDE.md` as an agent prompt, which is not code quality. The two Stylelint patterns are SCSS rules that report "unknown rule" on every plain CSS file. The dependency-versions pattern flags every caret range in a `package.json` while `pnpm-lock.yaml` already pins what `CI` installs with `--frozen-lockfile`. The Terraform password pattern matches the `password` autocomplete attributes of the sign-in form. That is the bar for disabling a pattern: it is wrong for the stack as a whole, not for one line. A false positive on a single line is ignored with a reason (`codacy issue <id> --ignore --ignore-reason "..."`) and the pattern stays on. `codacy tools` and `codacy patterns <tool> --enabled` list the live configuration.
- **`Board` on pull request and issue events**: keeps the project board in step with GitHub activity (see [workflow.md](workflow.md), "Task lifecycle"). A pull request that is opened, reopened, marked ready for review, or edited moves itself and every issue it closes (`Closes #n`) to **In review**; a merged pull request moves them to **Done**; a closed issue moves to **Done**. Draft pull requests and pull requests closed without merging move nothing. The logic is `.github/scripts/board.js`, run with `actions/github-script`. It needs a `PROJECT_TOKEN` repository secret: a personal access token of a collaborator with `project` scope (classic) or read and write access to the project (fine-grained), because the workflow token cannot edit a project board. The workflow runs on `pull_request_target`, so it always executes the script from the base branch and works for pull requests from forks.
- **Branch protection**: `main` and `develop` require the five `CI` checks and `Codacy Static Code Analysis`; `main` also requires `Release document`.
- **On merge to `develop`**: build images and deploy to the **test environment**. Pending the deployment target decision.
- **On merge to `main`**: build images, tag `vX.Y.Z`, publish a GitHub Release from the release document, and deploy to **production**. Pending the deployment target decision.

## Open decisions

Tracked in [docs/adr/README.md](adr/README.md) under "Pending".
