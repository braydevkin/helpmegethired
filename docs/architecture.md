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
- Pages follow the application flow: sign up and sign in, then the journey (upload resume, profile page, choose the Model and supply the Model Key, Profile Curation and its analysis page, job description, analysis, resume recommendations, study recommendations, mock interview, summary).
- Because steps are sequential (TC-06), the UI exposes a step as available only when the backend reports the previous step complete. The UI never decides step order on its own.
- Profile-building progress (TC-04) is shown as a percentage, driven by backend state.

### Components follow atomic design (ADR-0015)

Shared components live under `src/components`, in one folder per stage of [atomic design](https://atomicdesign.bradfrost.com/chapter-2/); pages are the `page.tsx` files under `src/app`:

```
apps/web/src/
├── app/                      pages: page.tsx with real content, route groups and layout.tsx
│   ├── layout.tsx            root: the Manrope font variable and globals.css, nothing visible
│   ├── (site)/               home under the site header
│   ├── (account)/            sign in and sign up inside the account template
│   └── (journey)/            the journey steps inside the site template: /journey, /journey/resume, /journey/profile
└── components/
    ├── atoms/                button, text input, select, label, eyebrow, hint, error message, progress bar (steps or fill), badge, logo mark, code box, status dot, file type mark, card label, inline notice, avatar
    ├── molecules/            field; code input; phone field; verified email field; labelled divider; screen heading; resend countdown; drop zone; tip card; file progress card; pipeline stage row; profile data row
    ├── organisms/            brand panel; email form; code form; identity form; done card; upload drop area; ingestion progress
    └── templates/            account template: brand panel beside the centred form column, panel hidden below 900px; site template: header with the step label and the Candidate's initials over a centred 880px column
```

- A stage imports only from the stages below it: atoms import nothing under `components/`, molecules import atoms, organisms import molecules and atoms, templates import organisms and below. Only pages touch the API client, the Session, and server actions; components receive what they need as props. The `atomic-design/no-upward-stage-imports` rule in `apps/web/eslint/` fails the lint on an import that goes up a stage, sideways to another component of the same stage, or into `src/app`; a component may still import its own folder, `src/lib`, packages, and libraries.
- A route group `layout.tsx` renders a template from `components/templates/`, so the template is a plain component that Vitest renders without the router. Frost's template is not the App Router's reserved `template.tsx`. The `(account)` layout renders `AccountTemplate`; the `(site)` layout renders the header for the home page; the journey pages under `(journey)` render `SiteTemplate` themselves through `JourneyFrame`, because the step label differs per page; so the root layout stays empty and the brand panel can fill the viewport.
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
- `/journey` is the first authenticated page and renders the journey's current step, the résumé upload until the Profile page exists (design open point 10); `/journey/resume` is that step's own route and `/journey/profile` the Profile page's. Every journey page asks the API for the Account behind the cookie (`requireCandidate`) and redirects to `/sign-in` when the API no longer accepts the token. Sign out is a server action that deletes the Session at the API, clears the cookie, and redirects to `/sign-in`.
- `src/proxy.ts` handles the redirects before a page renders: an authenticated path without the cookie goes to `/sign-in`; with a cookie the proxy asks the API for the Account: a stale token is cleared (and an authenticated path goes to `/sign-in`), an Account without a name is sent to `/sign-up` from every other path so the account information step is finished first, and a complete Account is sent from the forms to `/journey`.

### Upload page (FR-02, TC-04)

The résumé step of the journey follows [Design: Resume Upload](https://github.com/braydevkin/helpmegethired/wiki/Design-Resume-Upload) with the defaults of its open points. `ResumeUploadFlow`, a client component next to the page, holds one state: idle (with the message of a refused file), uploading (the bytes on their way), or tracked (the record as the API last answered it). The pure rules live in `src/lib/resume-upload`: `rejectionOf` refuses a non-PDF or a file over `RESUME_MAX_SIZE_BYTES` in the browser with the designed messages before anything is sent; `percentageOf` composes one number from the byte progress (0 to 25), the record status (`uploaded` 25, `processing` 30), and the Ingestion Progress mapped onto 30 to 100; `stagesOf` drives the five pipeline stages from the same view, marking the running one red when the record failed; `profileDataRowsOf` ticks the eleven Profile data rows from the saved Segment kinds the Progress carries; `failureLeadOf` holds the lead per error code. `pollDelayMs` in `src/lib/poll-delay.ts` doubles from one second and caps at ten, for every page that polls.

- Three server actions in `src/app/(journey)/journey/resume/actions.ts` are the page's only way to the API, through `ResumeClient`: `createResumeAction` parses `ResumeUploadSchema` and calls `POST /resumes` with the SHA-256 computed in the browser (`crypto.subtle`), `completeResumeAction` calls `POST /resumes/:id/complete`, and `readResumeAction` calls `GET /resumes/:id` with the last `ETag` as `If-None-Match`, answering "unchanged" on `304`. A `409` becomes the design's copy (`ingestion_active`, `upload_incomplete`); the Session token never reaches the browser.
- The bytes go from the browser straight to the presigned URL with an `XMLHttpRequest`, whose upload progress fills the first stage; `Cancel upload` aborts it and leaves the record to expire (open point 6), and a failed transfer returns to idle with the `upload_incomplete` message, the same file picked again landing on the same record with a fresh URL.
- While the record is `uploaded` or `processing`, the page polls with the backoff above and stops on `done` or `failed`. On load the server component reads the newest record from `GET /resumes`: `uploaded`, `processing`, `done`, or `failed` is shown as it is, so a reload or another device sees the same state and percentage; a `pending` record, whose bytes never arrived, starts the page over. Nothing is kept in the browser.
- Done offers `Review my profile` to `/journey/profile` and `Upload a different PDF`; failed shows the lead for the code and only `Upload a different PDF`. The Playwright test `resume-upload.spec.ts` uploads a corpus PDF through the page, sees 100 percent and eleven of eleven rows, reloads, and reaches the Profile page.

- The API origin comes from `API_URL`, read on the server only, defaulting to `http://localhost:3001` for a native `next dev`. The compose stack sets it to `http://api:3001` and gives the web app the same `DATABASE_URL` as the API. The variables are listed in `apps/web/.env.example`.

### Analysis progress (FR-12, TC-04)

The wait while a Curation runs follows the progress component of [Design: AI Analysis](https://github.com/braydevkin/helpmegethired/wiki/Design-AI-Analysis). The `AnalysisProgress` organism takes a `CurationProgress` from `GET /profile/curation` and renders only what the payload holds: the API's percentage, `{saved} of {total} saved`, the pass being read, a window of five `CurationUnitRow`s around it (the saved pass before it stays in view), the career length and counts the model was given, and the footnote that the tab can be closed. It never advances between two answers, so a reload shows the same figure. A Curation back in `queued` with a `resumeAfter` is rendered as paused by a provider rate limit, with the time it resumes as a status a screen reader announces, written by `LocalTime` in the browser because the server cannot know the Candidate's time zone; a failed pass says what happened in plain words. No duration, token count, or cost is shown (#102).

- The pure rules live in `src/lib/curation-progress/view.ts`: `phaseOf` (active, paused, completed, failed, cancelled, superseded), `focusIndexOf` (the first running unit, else the next waiting, else the first failed, since three run at once), `unitWindowOf`, `passLabelOf`, `headingOf`, `footnoteOf`, and `metricChipsOf`.
- `CurationClient.read` in `src/lib/curation-client.ts` sends the last `ETag` as `If-None-Match` and answers "unchanged" on `304`; a refusal carries the shared `CurationActionErrorCode`.
- `useCurationProgress(initial, read)` polls with `pollDelayMs` while the Curation is `queued` or `running` and stops on `completed`, `failed`, `cancelled`, or `superseded`, or when there is no Curation. `replace` takes the state a cancel, retry, or re-run answered with and starts watching again. The page (#123) passes a server action as `read`, so the Session token never reaches the browser.

## Backend (apps/api)

- NestJS modules mirror the domain:
  - `auth` (Account, authorization)
  - `profile` (the seven Profile parts, `GET /profile`, confirmation)
  - `resumes` (Uploaded Resume, its state machine, the four resume routes)
  - `storage` (the `ObjectStorage` abstraction over the S3 clients)
  - `parser` (rule-based extraction of Profile parts from text; pure functions)
  - `ingestion` (Ingestion, Segments, Steps, the Segment processors)
  - `curation` (Curations, Curation Units, Statements, their review, the runner, and model access)
  - `queue` (the BullMQ connection and the queues)
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
- `migrations/` holds one TypeScript module per migration with `up` and `down`, registered in `migrations/index.ts`. `migrator.ts` wraps Kysely's `Migrator`; `migrate.cli.ts` is the command behind `pnpm db:migrate` and `pnpm db:migrate:down`, which Turbo runs after building the API and its workspace dependencies. The first migration enables the `vector` extension and creates `accounts`; the second adds the password hash and creates `sessions`; the third creates `ingestions` and `ingestion_segments`; the fourth drops the password hash, adds the Account information and the email verification time to `accounts`, and creates `verification_tokens` for the one-time codes; the fifth creates `uploaded_resumes`; the sixth creates the Profile tables; the seventh creates `curations`, `curation_units`, and `statements`, with `statements.embedding` a `vector(1536)` under an HNSW index that, like the per-Account retrieval index, leaves rejected Statements out.

### Object storage (FR-02)

The `storage` module is the only code that talks to the object store, following ADR-0021:

- `ObjectStorage` is the abstraction the resume routes, the extraction processor, and the reconciliation job depend on: `presignPut(key, size, sha256, contentType)` answers the URL, the headers the browser must send, and the expiry; `head(key)` answers the stored size or `undefined`; `getStream(key)` streams the bytes; `delete(key)` removes them; `list(prefix)` answers every key under a prefix with the time it was written, for the bucket sweep. `S3ObjectStorage` is the one implementation, built on the AWS S3 client library, and nothing in it names a product.
- `StorageModule` builds two `S3Client`s from the `S3_*` variables, both with path-style URLs and the SDK's own checksum handling limited to where the API requires it: the internal client on `S3_ENDPOINT` performs `head`, `getStream`, and `delete`; the public client on `S3_PUBLIC_ENDPOINT` only signs, because its address is the one embedded in the URL the browser uses.
- The presigned `PUT` signs the content type, the content length, and the SHA-256 (`x-amz-checksum-sha256`, kept as a header rather than hoisted into the query string) and expires after `PRESIGN_EXPIRES_SECONDS`. A `PUT` whose size or checksum differs from the signed values fails the signature, and a body whose digest differs from the signed checksum is refused by the store, so a different file never lands under the key. `presignPut` returns those headers so the route hands them to the browser unchanged.
- The integration test runs the four operations against the compose `storage` service with `fetch` as the browser.

### Profile ingestion (TC-03, TC-04, TC-05)

Profile building is an **Ingestion**: one run for one Account from one source, split into ordered **Segments**, each of which goes through three **Steps**. The vocabulary is in [CONTEXT.md](../CONTEXT.md); the queue decision is ADR-0020. The `ingestion` module holds the state machine and its persistence; the resume Segment processors are described under [Resume upload and extraction](#resume-upload-and-extraction-fr-02-tc-01).

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

**Processors.** A `SegmentProcessor` implements `read`, `recognize`, and `save` for one Segment `kind`; the `SegmentProcessorRegistry` resolves the processor by kind. The module that owns a source registers its processors when it starts, so the `ingestion` module knows no kind: the worker loads `ProfileIngestionModule`, which registers the resume kinds listed under [Segments from sections](#segments-from-sections), and the API process registers none. The tests keep a scripted processor for the state machine.

**Observers.** An Ingestion carries its `source` (`upload`, the only source since LinkedIn reading was removed) and its `completed_at`. What follows its end is not the runner's business either: an `IngestionObserver` registered the same way is called with the completed Ingestion inside the transaction that marks it completed, and with the failed one once every attempt is used. The resume observer replaces the previous Profile and settles the Uploaded Resume, as described under [Replace by source Ingestion](#replace-by-source-ingestion).

**Queue.** `IngestionQueue` is the abstraction (`enqueue`, `work`); `BullMqIngestionQueue` implements it on the `profile-ingestion` queue with exponential backoff between retries, completed jobs expired after a day, and failed jobs kept for inspection. The `QueueModule` builds two connection configurations from `REDIS_URL`: the producer one keeps the driver's finite retries and `enqueue` gives up after five seconds, so a request never hangs on a Redis outage and the Ingestion is logged for the reconciliation job; the consumer one retries for ever, which BullMQ requires for its blocking reads. Only the [worker](#the-worker) registers processors, and its consumer takes `WORKER_CONCURRENCY` jobs at a time under a 30-second lock renewed while the run is alive. A job whose lock expires is stalled: the queue re-delivers it up to `max_attempts - 1` times, one fewer than the row allows attempts because every re-delivery increments `attempts`, and a job stalled beyond that is failed in the queue and left to the reconciliation job. The tests run the state machine through a recording queue and two scenarios through the real one: a retry after a failed Step, and a re-delivery after a worker that holds the lock is closed without finishing.

### Resume upload and extraction (FR-02, TC-01)

The Candidate uploads a PDF, the platform extracts its text once, and an Ingestion builds the Profile from that text. The screens are [Design: Resume Upload](https://github.com/braydevkin/helpmegethired/wiki/Design-Resume-Upload) and [Design: Profile](https://github.com/braydevkin/helpmegethired/wiki/Design-Profile) on the wiki; the maintainer's upload lane is `design/resume/system-design.png` there, from `arch/hgh.drawio`. The decisions are ADR-0020 (queues and worker) and ADR-0021 (object storage); the limits and error codes are fixed by #52. The terms (Uploaded Resume, Ingestion, Segment, Step, Progress, the seven Profile parts, Confidence) are in [CONTEXT.md](../CONTEXT.md).

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

`done` means the Profile is saved, not only the text extracted: the record stays `processing` while the Ingestion runs, and the upload page derives its "Building your profile" stage from the Ingestion's Progress. A `failed` record carries one error code, which the page turns into a message: `not_pdf`, `too_large`, `too_many_pages`, `encrypted_pdf`, `corrupt_pdf`, `scanned_pdf`, `upload_incomplete`, `extraction_failed` (retries exhausted on a transient error), and `profile_build_failed` (the Ingestion exhausted its attempts). `POST /resumes` never refuses a new upload; `complete` answers `409 ingestion_active` while the Account has another record `uploaded` or `processing` or an active Ingestion (TC-05). Uploading the same bytes twice (same Account, same SHA-256) answers the existing record and creates no second job. Both rules are indexes, not only checks: `uploaded_resumes_one_live_per_file_idx` is unique on `(account_id, sha256)` while the record is not `failed` or `expired`, so a rejected file can be uploaded again, and `uploaded_resumes_one_in_flight_per_account_idx` is unique on `account_id` while the record is `uploaded` or `processing`, so two concurrent `complete` calls cannot both pass. The `resumes` module maps its errors to HTTP in one exception filter: not found is `404`, and the two conflicts carry their code in the `ApiError` body.

#### The four queues

| Queue | One job per | Job id | Producer | Consumer |
| --- | --- | --- | --- | --- |
| `resume-extraction` | Uploaded Resume | the record id | `complete`, or the reconciliation job | the extraction processor on the worker |
| `profile-ingestion` | Ingestion | the Ingestion id | the extraction processor, after it creates the Ingestion | the Ingestion runner on the worker |
| `profile-curation` | Curation | the Curation id | the confirmation or the stored Model Key that completes the [trigger](#profile-curation-tc-04-tc-05-tc-06), `retry`, or the reconciliation job | the Curation runner on the worker |
| `reconciliation` | interval | the job scheduler `reconciliation` | every worker, upserting the same scheduler at start | one worker at a time, one run at a time |

The job id equal to the record id makes every add idempotent, and every processor begins by reading what is already persisted and skipping it, so a re-delivery after a crash, a stalled lock, or a reconciliation run never repeats work. Every row carries `attempts` and `max_attempts`; the processor increments `attempts` in the write that marks the row `processing` or `running`, before doing any work, so a run killed without reporting still counts and the reconciliation job never re-enqueues past the limit. Backoff is exponential, and failed jobs are kept so the queue dashboard shows them. The enqueue always happens after the PostgreSQL transaction commits; an enqueue failure is logged and left to the reconciliation job, never surfaced as a request error.

#### The worker

`apps/api/src/worker.ts` is a second Nest entrypoint (`createApplicationContext(WorkerModule)`) that hosts every processor: extraction, the Ingestion runner, the Curation runner, and the reconciliation job. It runs with `WORKER_CONCURRENCY` jobs at a time (default 4), renews the lock of every active job, and closes every queue on `SIGTERM`. The `worker` compose service is built from the API image with the same environment as `api`, no port, and a memory limit, so a hostile PDF can exhaust the worker and never the API. The API process registers no processor.

#### Extraction

The extraction processor takes an `uploaded` record, marks it `processing` and increments its `attempts` in one write, and streams the object from storage:

1. **Validation of what storage could not check**: the object is read into memory up to the size limit, because a PDF's page tree sits at its end and nothing can be decided from a prefix; one byte over the limit is `too_large`. The buffer must start with the magic bytes (`%PDF-`, otherwise `not_pdf`), and `pdfjs-dist` opens it without rendering anything to count the pages (over 20 is `too_many_pages`) and to refuse a password-protected (`encrypted_pdf`) or unreadable (`corrupt_pdf`) document. Each failure is unrecoverable: the record becomes `failed` with its code and the object is deleted.
2. **Text extraction** with `pdftotext -layout` from poppler as a child process fed through its standard input and killed after `EXTRACTION_TIMEOUT_MS` (default 30 s). Its exit codes decide: 1 with an "Incorrect password" line or 3 is `encrypted_pdf`, any other 1 is `corrupt_pdf`; a signal or another code is poppler's own failure and `pdfjs-dist` extracts the text in-process instead, as it does when the executable cannot be started at all. A timeout is never handed to the fallback: the process is killed and the job retried. Neither extractor has network access. The stored `extractor_version` names which one produced the text (`pdftotext/<version>` or `pdfjs-dist/<version>`), and the worker logs the installed `pdftotext` version when it starts.
3. **Scanned detection**: fewer than 200 non-blank characters on a file over 50 KB is `scanned_pdf`. OCR is out of this phase.
4. **The raw text and the extractor version are saved on the record first**, then the object is deleted. A job re-delivered after this point deletes the object again if needed and hands over without running `pdftotext`, and a later extractor or an LLM extraction reads the stored text, never the PDF.
5. **Hand over** through `ExtractionHandover`: the section splitter turns the stored text into Segments, the Ingestion is inserted with `source = upload` and linked to the record (`ingestion_id`) in the same transaction, and its job is added after the commit. The record stays `processing`; a job re-delivered after the link finds it and never starts a second Ingestion.

The processor counts the attempt in the write that marks the record `processing`, so a run killed without reporting still counts, and a job that finds no attempt left fails the record with `extraction_failed`. Storage or database errors and timeouts record their message on the row and retry with backoff up to `max_attempts`, then end in `failed` with `extraction_failed`; the object is deleted whenever the record fails. A delete that fails never decides the outcome: the reconciliation job sweeps the bucket. The extractor runs only on the worker; the API image ships poppler because both services share it, and CI installs it on the integration runner so the tests exercise `pdftotext` and not only the fallback.

#### Segments from sections

The section splitter (parser foundation) cuts the cleaned text into sections, and the sections decide the Segments, in this order: `header` (the text before the first heading, the contact block, and the summary sections: headline, summary, LinkedIn URL, GitHub URL), one `experience` per block of the experience sections (a block is cut at blank lines and at a titled heading, so a LaTeX-like résumé without blank lines is one block), `education`, one `project` per block of the projects sections, `skills` over the whole text (the Skills are the union of the skills section and every technology named in an Experience or a Project, so this Segment exists whenever the text does), `languages`, `certifications`. A part the résumé lacks produces no Segment. A labelled paragraph found in another section (`Idiomas: …` under the summary, `Certificações: …` closing the experience) belongs to the Segment of its kind, and a block that is only such a paragraph is no entry.

A Segment's `input` names the Uploaded Resume and the line ranges of the cleaned text it covers, never the text itself, so Candidate data lives in one place. Each kind has a `SegmentProcessor`: `read` loads the stored text, cleans it, and answers the Segment's slice (a labelled paragraph joined into one line); `recognize` runs the parser layer for that kind and answers every field with its Confidence, which is what the Segment keeps; `save` writes the typed rows tagged with the Account, the source Ingestion, and the Segment, replacing what the same Segment wrote before, so a save that runs again after a crash never doubles a row. The upload page's Profile data checklist ticks along these kinds as their `save` Steps complete.

The header processor reads the name and the e-mail only to compare them with the Account: a difference is a review flag (`account_mismatch`). Name, e-mail, and phone are never written into a Profile table.

#### Replace by source Ingestion

Every Profile row records the Ingestion that wrote it (`source_ingestion_id`). `GET /profile` reads the rows of the latest completed Ingestion of the resume source (`ingestions.completed_at`), and answers an empty Profile with no source while none has completed. When an Ingestion completes, the resume observer deletes, in the same transaction, the rows written by the earlier Ingestions of that source and marks the Uploaded Resume `done`; the new rows carry no confirmation, so the review flags show again and the confirmation is reset. When an Ingestion fails for good, the observer fails the Uploaded Resume with `profile_build_failed` and the previous Profile stays readable, so the Candidate never sees a half-built Profile. A resume Ingestion never touches rows from another source.

**Review flags and confirmation.** The flags are not stored: `GET /profile` derives them from the Segments' recognized output of the Ingestion it reads, one flag per field recognised with `low` Confidence, named by its part, its entry (the role, the institution, the project name), and the field, plus the header's name or e-mail mismatch. `POST /profile/confirm` records the time on the Basic Profile row once (a repeat keeps it), after which the flags are empty until the next Ingestion replaces the rows. The years of experience are derived on read from the Experiences' periods with the overlap merge.

#### Reconciliation

A BullMQ repeatable job on the worker, every 5 minutes with a fixed repeat key so one instance exists however many workers run. It is what makes the state machine converge without a transactional enqueue. Every worker upserts the same job scheduler (`reconciliation`) on the `reconciliation` queue when it starts, so replicas share one schedule and one of them consumes each run, one run at a time; the run reads the present from a `Clock` the tests replace. A row "with no job" is one whose queue has no job with its id in a state that will still be delivered (waiting, active, delayed, prioritized, or waiting for children). A `processing` record that already carries an Ingestion is the Ingestion's to settle, never re-enqueued for extraction. Each row is settled in one conditional write, so two runs cannot both act on it, and one row that cannot be settled is logged and left for the next run without stopping the others:

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
| Section splitting | A Portuguese and English header dictionary (contact, summary, experience, education, skills, projects, languages, certifications), accent-insensitive and blind to decorations, with a header score: a dictionary match counts 2, all caps, a short line (at most four words and forty characters), and a following blank line count 1 each, threshold 3, so a dictionary word inside a sentence never becomes a heading. The text before the first header is the header section; the header and a leading contact block together are the top of the resume, where the name and the headline are looked for |
| Experiences | Date range detection in both languages (month names and abbreviations, `MM/YYYY`, a year alone spanning January to December, `since`/`desde`, open endings), a line with a range starts an entry: its heading is the one or two short non-sentence lines before it (a line ending in a company abbreviation such as `Ltd.` is not a sentence; one ending in `Go.` is), or the rest of the range line when the dates come first; what follows up to the next heading is the description. A short line naming a role and a company after a sentence opens an entry without dates. Title and company split on the usual separators with a job title dictionary deciding which side is the title (`high`), both kept raw otherwise (`low`); a heading with a single part names a role and no company. The career duration in years and months (`careerDuration`) from the periods with overlaps and adjacent ranges merged, both ends inclusive, open ranges ending on the injected day: `GET /profile` answers its years as the years of experience, and the Curation metrics (`apps/api/src/curation/curation-metrics.ts`) reuse it for the whole career and for each company, so no second career-length calculation exists. Two-column interleaving still breaks headings until the regrouping lands |
| Education | Entries by the date range rule, the heading being the lines before the date line plus what the date line says besides the dates, with a wrapped line (one that starts lowercase, or any short line after the date line) joined to it. The parts split on the usual separators plus `in`/`em`; a degree dictionary (`bacharelado`, `bachelor`, `licenciatura`, `tecnólogo`, `mestrado`, `master`, `MBA`, `PhD`, `doutorado`, `MSc`, `BSc`, `BA`, `MEng`, `high school`, ...) names the degree part, the field of study is what follows `in`/`em` inside it or the next part when that reads as neither an institution nor a degree, and the institution is the part with an institution word (`universidade`, `university`, `instituto`, `college`, ...) or an all-caps acronym such as `UFSC`, else the first remaining part (all `high`). Without a degree word the first part is the institution and the second the degree, both `low` |
| Skills | A technology dictionary of about 300 terms in `dictionaries/technologies.ts`, each with its canonical name, synonyms compared after normalisation (`node`, `nodejs`, `node.js` → `Node.js`), a few spellings that only count with their exact casing because the lowercase word is prose (`Go`, `R`, `C`, `Express`), and a category (`Languages & runtimes`, `Frameworks & data`, `Infrastructure`, `Other`). The text is tokenised on whitespace and list punctuation, keeping `C++`, `C#`, and `.NET` whole, and the longest term wins at each position, so `Google Cloud Platform` is one match. Every section is matched and each technology is listed once: `high` when it appears under a skills heading, `medium` when only in prose. A technology named in an Experience's description is also attached to that Experience, and one named in a Project to that Project |
| Projects | Blocks split at blank lines and at a capitalised short line after a sentence; a block with date ranges follows the date rule. The name is the first part of the name line (before `—`, `·`, `\|`, or a colon), a link anywhere in the block is the URL and is taken out of the description, the remaining text is the description, and the skills are the dictionary matches over both (`high`) |
| Languages | The lines of the languages sections plus any labelled paragraph elsewhere (`Idiomas: Português (nativo), Inglês (fluente)` under the summary, wrapped lines included, taken out of the section it sits in), split at `;`, `,`, `\|`, and `·`. Each piece splits at the first dash, colon, or parenthesis into name and level, the level counting only when a level word or a CEFR code makes it one (`Inglês - Fluente (C1)` → `Inglês`, `Fluente (C1)`); without a separator the level words are told apart from the name (`Inglês fluente`). Everything `medium` |
| Certifications | The lines of the certifications sections plus any labelled paragraph elsewhere (`Certificações: CCNP (Cisco, 2022); CCNA (Cisco, 2017)` closing the experience, taken out of it), each line split at `;`, `\|`, `·`. On each line the year is the start of a date range or the first year, taken out; the name runs up to the first separator (`—`, `\|`, `·`, `(`, `,`, `by`, `por`) and the issuer follows it, so `Name — Issuer, 2023`, `Name (Issuer, 2021)`, and `2022 Name, Issuer` all read the same. Everything `medium` |

The output is `ProfileDraftSchema` in `packages/shared`: the seven parts, each field wrapped with its value and Confidence, and the parser version. Two-column layouts regrouped by coordinates are a follow-up.

#### Synthetic corpus

Parser quality is measured against a corpus of résumés with expected output, and a rule change that regresses another case is caught by a snapshot. The corpus holds no real person's data: fictional people and companies described in `people.ts` and rendered through HTML templates to PDF with Playwright's Chromium (`pnpm --filter api corpus:generate`), in several layouts (single column, two columns, Canva-like, LaTeX-like, LinkedIn export), in Portuguese and English, with the PDF, its text as `pdftotext -layout` extracts it (`pnpm --filter api corpus:extract`, run where poppler is installed), and its expected JSON committed under `apps/api/test/fixtures/resumes/corpus`. The snapshot suite (`src/parser/corpus.test.ts`) runs with `pnpm test`, without Docker, because the text is committed; a rule change updates the expected files deliberately in the same pull request with `vitest run -u`, and a real résumé is never committed. The corpus holds thirty résumés, the milestone target, and beside the plain order of each layout it covers the education before the experience, no skills section at all, the languages on one labelled line under the summary, and the certifications on one labelled line closing the experience (`variants` in `people.ts`). Two-column layouts, the LinkedIn export among them, come out of `pdftotext -layout` with both columns on the same lines, so their sections split poorly until the regrouping by coordinates lands; their expected files record that outcome. Beside the corpus sits the set of hostile PDFs from #52 that the extraction tests feed the worker.

#### Client contract

Every route is Candidate-owned: another Account's id answers `404` everywhere. Schemas live in `packages/shared` (`UploadedResumeSchema`, `ResumeUploadSchema`, `ProfileSchema`, and the error codes). The whole contract, these routes plus the Account and health ones, is the OpenAPI 3.1 document `apps/api/openapi/openapi.json`, generated from those schemas by `pnpm --filter @helpmegethired/api openapi` and checked against the code by the CI `lint` job (ADR-0022); Swagger UI serves it at `GET /docs` outside production, where the Session token is pasted as the bearer, and the wiki guide [Guide: Walk the upload API](https://github.com/braydevkin/helpmegethired/wiki/Guide-Walk-the-upload-API) walks it by hand.

| Route | Answers |
| --- | --- |
| `POST /resumes` (file name, size, SHA-256, content type) | `201` with the record, the presigned `PUT` URL, and its expiry; `200` with the existing record when the same bytes are already `uploaded`, `processing`, or `done`; a `pending` duplicate gets a fresh URL |
| `POST /resumes/:id/complete` | `202` and the record `uploaded`; `409 upload_incomplete` when the object is still missing after three `HeadObject` calls 500 ms apart, or when its size differs, in which case the record stays `pending` and the reconciliation job promotes it once the object is visible; `409 ingestion_active` while another upload or Ingestion is active; idempotent for a record no longer `pending` |
| `GET /resumes/:id` | The record with its status, error code, and the Ingestion Progress when it exists (percentage, Segment counts, and the kinds of the saved Segments in order, which tick the Profile data rows); an `ETag` from status, error, and Progress, `304` on `If-None-Match`, so the page can poll cheaply |
| `GET /resumes` | The Account's records, newest first, optional status filter |
| `GET /profile` | The seven Profile parts of the latest completed resume Ingestion, the source (Uploaded Resume, file name, Ingestion, completion time), the review flags, the derived years of experience, and the confirmation time; an empty Profile with no source before any Ingestion completes |
| `POST /profile/confirm` | `200` with the Profile, its flags cleared and the confirmation time recorded once; idempotent; `404` while no Profile has been built |

The upload page composes its single percentage from the byte progress of the `PUT` (0 to 25), the record status (`uploaded` 25, `processing` 30), and the Ingestion Progress mapped onto 30 to 100. Nothing on the page comes from a timer.

### Profile Curation (TC-04, TC-05, TC-06)

Profile Curation turns a confirmed Profile into the Statements every later AI layer reads (ADR-0024). It has the moving parts of an [Ingestion](#profile-ingestion-tc-03-tc-04-tc-05), a row per run, a row per unit of work, a queue, resumption, and reconciliation, and adds what an Ingestion does not have: one model call per unit, on the Candidate's own Model Key (ADR-0023). The terms (Curation, Curation Unit, Statement, Evidence, Statement review) are in [CONTEXT.md](../CONTEXT.md); the rules every model call is held to are in [security.md, "AI pipeline"](security.md#ai-pipeline-tc-06-tc-07). The `curation` module holds the state machine, its persistence, and the model access; the runner runs on the worker only, and the API process registers no processor.

```
confirm, a Model Key already stored ──┐
                                      ├─▶ curations (queued) + curation_units (pending), one transaction
Model Key stored, Profile confirmed ──┘                                            │ after commit
                                                  profile-curation job, id = curation id
                                                                                  │
                             worker: run(curationId) ◀─────────────────────────────┘
                                      │
                   before each unit: status still running? otherwise stop, no error
                                      │
             every unit not yet saved, three at a time, the synthesis unit last:
               computed facts + unit input (≤ 8,000 characters) ──▶ model ──▶ schema ──▶ Evidence resolves?
                                      │                                                  │ yes: Statement saved
                                      │                                                  │ no: discarded, logged
                   every unit saved ──▶ embed every Statement + completed, one transaction
                   a call fails ──▶ unit keeps its outcome; attempts < max ? queued (retry) : failed
                   a Provider rate limit ──▶ resume_after, queued, the attempt kept
```

**Trigger.** A Curation starts once the Profile is confirmed and a Model Key is stored, whichever comes last. `POST /profile/confirm` creates it when a key is already stored; `PUT /account/model` creates it when it stores a key for a confirmed Profile that has no Curation for its Ingestion. Confirm never requires a key, answers `200` on every repeat, and never answers `409`. Both go through `CurationStarter.commitAndStart`, which takes the Account lock, runs the confirmation or the key upsert, and in the same transaction creates the Curation when the latest completed Profile is confirmed and a key is stored, so a failure in either rolls back both. It creates one only when the Account has none for that `source_ingestion_id` outside `failed` and `cancelled`, and none active for an earlier Ingestion, which a new Ingestion supersedes first (#116). Two requests serialise on the Account lock, so the second finds the first one's Curation and creates nothing; the partial unique index stays as the backstop. The units are derived by `unitsOf` from the Profile's Experiences and Projects. The job is added after the commit with the Curation id as job id; a failed enqueue leaves the row `queued` for [reconciliation](#curation-reconciliation) and never fails the request.

#### Curation state machine

A Curation is `queued` (waiting for a worker, on the first attempt, after a failed one, or after a rate limit), `running` (a worker is processing it), `completed` (every unit saved and every Statement embedded), `failed` (every attempt used), `cancelled` (stopped by the Candidate), or `superseded` (replaced by a new Ingestion or by a completed re-run). The last four free the Account. The worker increments `attempts` in the write that moves the row to `running`, before any call, so a run killed without reporting still counts; `max_attempts` is 3, as for an Ingestion, and is sent to BullMQ as the job's attempts.

| From | To | Written by | When |
| --- | --- | --- | --- |
| — | `queued` | API, the confirmation or the stored key that completes the trigger, or `rerun` | The Curation and its units are inserted in one transaction |
| `queued` | `running` | Worker | The job starts; `attempts` is incremented in the same write |
| `running` | `queued` | Worker | A call produced no usable output and `attempts` is below `max_attempts` (retried with backoff), or the Provider rate-limited the Candidate's key or reported an exhausted quota (`resume_after` set, the attempt not consumed) |
| `running` | `completed` | Worker | The last vectors are written, in the same transaction |
| `running` | `failed` | Worker, or the reconciliation job | `attempts` reached `max_attempts`; the reason is one the Candidate can read |
| `queued`, `running` | `cancelled` | API, `POST /profile/curation/cancel` | The Candidate stops it; saved Statements are kept, nothing is indexed, and the units left `running` are `pending` again |
| `failed`, `cancelled` | `queued` | API, `POST /profile/curation/retry` | `attempts` reset, reason and `resume_after` cleared, `failed` and `running` units `pending` again, re-enqueued under the same job id |
| any | `superseded` | The resume observer, or a Curation of the Account completing | A new Ingestion replaced the Profile, or another Curation completed and became current |

**One active Curation per Account.** The partial unique index `curations_one_active_per_account_idx` on `account_id where status in ('queued', 'running')` enforces it in the database, not in a service (TC-05). It is one active Ingestion and one active Curation per Account, not a lock across both: a new Resume can be uploaded while a Curation runs, and its Ingestion then supersedes that Curation.

**Unit states.** A Curation Unit is `pending`, `running`, `saved`, or `failed`, and carries its own `attempts`, the outcome of its last call as `failure_reason` (an outcome code from [security.md](security.md#ai-pipeline-tc-06-tc-07), never the Provider's message), and whether its input was `truncated`.

#### Curation Units

The units are derived in the transaction that creates the Curation, so progress has a denominator from the first second: one `experience` unit per Experience, one `project` unit per Project, one `cross_cutting` unit for the competences that appear in more than one place, and one `synthesis` unit, ordered by position with the synthesis unit last. There is no cap; the thirty corpus Resumes give 2 to 8 units, median 4.

- **Input.** Each unit's subject, capped at 8,000 characters and cut at a line boundary, with `truncated` recorded when the cap applied, inside the delimiters the security rules require. The deterministic facts computed by the pure metrics module (career duration, duration per company and per Project, the counts of roles, projects, certifications, languages, and education) sit outside the Candidate block as computed facts, so the model judges and never counts. The synthesis unit reads the Statements the other units saved.
- **Resumption.** A retry calls the same `run(curationId)`. The runner reads which units are already `saved` and processes only the others, so a retry pays only for what is left.
- **Concurrency.** Three units run at a time; the synthesis unit runs alone once every other unit is saved. The integration suite pins concurrency to 1 so the order is deterministic.
- **Stopping at a boundary.** The runner re-reads the Curation's status before each unit and before writing `completed`; anything other than `running` ends the run cleanly, with no error and no retry, and so does an attempt that fails after the Curation left `running`. Every Statement write is conditional on the Curation still being `running`, so a runner that lost the race to a cancel, a supersede, or a re-run writes nothing and wastes at most one call.
- **Failure.** A timeout, invalid JSON, a response that fails the schema, and a truncated response are one event: the call produced no usable output. It fails that unit, not the run, and records the outcome on the unit row, never on the queue. A Provider rate limit is not a failure: it says nothing about the input, so the Curation returns to `queued` with `resume_after` and keeps the attempt.
- **Runner.** `CurationRunner.run` on the worker (`CurationRunnerModule`, which also loads the model access and the Model Key, so the API never does) takes every unsaved unit through `sourcesOf`, `cappedInput`, and the prompts of `curation-prompts.ts`, whose version is `CURATION_PROMPT_VERSION`, and resolves each citation with `resolveEvidence`: a quote must stand verbatim in the cited Experience or Project description or in the Uploaded Resume's text, and its offsets are found there, never taken from the model. A failed unit does not stop the others; once they ran, the attempt fails and the queue retries it with its backoff, the synthesis unit waiting until every other unit is saved. A key the Provider refuses, or one revoked before the run, fails the Curation with `model_key_rejected`. Each call writes one line of ids, the Model, the prompt version, token counts, latency, and the outcome.

#### Statements and Evidence

A unit's response is parsed by the shared Statement schema and its Statements are saved as soon as they validate. Each `statements` row holds the sentence, its labels for filtering before retrieval, its Evidence, the prompt version, the Model, `source_ingestion_id`, the review state with `reviewed_at`, and, once the Curation completes, the embedding.

- **Evidence** points at an Experience, a Project, or a span of the extracted text (`experience`, `project`, `text_span`), with the quoted span and its offsets. It is resolved against the Account's own Profile before the Statement is saved; a Statement whose Evidence does not resolve is discarded, never persisted, and the discard is logged with the unit id. This is the one programmatic check against a hallucination entering the index as fact. A Statement that is wrong but cites real Evidence passes it, which is what Statement review is for.
- **Versions.** The prompt version and the Model are on every row because the output is non-deterministic and kept indefinitely: an improved prompt reaches an already-curated Candidate only through a re-run, and every Statement stays readable back to what produced it.
- **Statement review.** The Candidate marks a Statement `accepted` or `rejected`, or clears it back to `unreviewed`. A rejected Statement keeps its row and its embedding and is excluded from retrieval by a partial index; accepted and unreviewed Statements are both retrieved, since acceptance is an affirmation, not a precondition. Review does not carry across a re-run in this release, because a new Statement has no stable identity to inherit it from (#126).

#### Embedding and retrieval

Once every unit is saved, every Statement of the Curation is embedded through the platform embedding model into `vector(1536)` (ADR-0023), and `completed` is written in the same transaction as the last vectors, before the job returns. An embedding failure is a failure of the Curation, not of a unit: attempts and backoff apply, and no Statement is left half-indexed. The per-Account embedding budget is checked before every embedding call, and reaching it pauses the Curation with `resume_after` rather than failing it (#133).

Retrieval reads the Statements of the Account's current Curation, the latest `completed` one, excluding rejected ones, filtered by `account_id` in SQL before similarity ordering. No later layer reads the Profile or the extracted text (ADR-0024); the extracted text stays on the Uploaded Resume as an auditable fallback. `StatementRepository.nearest(accountId, query, limit)` is that read, ordered by cosine distance under the HNSW index, and `CurationRunRepository.completeWithEmbeddings` is the one transaction that writes every vector and `completed`, only while the Curation still runs.

#### Invalidation and re-run

- **A new Ingestion supersedes.** In the transaction that replaces the Profile rows, the [resume observer](#replace-by-source-ingestion) moves every Curation of an earlier Ingestion to `superseded`, a `failed` or `cancelled` one included so nothing built on the replaced Profile can be retried, and deletes the Account's Statements of earlier Ingestions with their embeddings, so retrieval finds nothing until a new Curation completes; a rollback keeps both. It locks those Curation rows before the Account row, the order a runner saving a unit takes them in, and holds the Account lock so no confirm of the replaced Profile starts a Curation beside them. Each one is logged by its id and the new Ingestion's id. A running runner stops at its next unit boundary. Nothing restarts by itself: the new Ingestion resets the confirmation, so the next confirm (with a Model Key stored) creates a fresh Curation, and the Job Description steps stay locked until it completes.
- **Cancel** stops a `queued` or `running` Curation at a unit boundary, keeping its saved Statements and indexing nothing; the units it left `running` are `pending` again. **Retry** takes the newest Curation of the Profile, when it is `failed` or `cancelled`, back to `queued` under the same job id and resumes at the first unsaved unit, so the Candidate pays only for what is left. A Curation started under another Model than the Account's current one is not retried, since it would mix two Models' Statements; it is refused with `curation_model_changed` and re-run instead.
- **Re-run** builds a new Curation alongside the current completed one, which stays current and retrievable. When the new one completes it becomes current: `completeWithEmbeddings` supersedes every other Curation of the Account, the previous one and any failed or cancelled attempt included, and deletes their Statements and embeddings in the transaction that writes `completed`. A re-run that fails or is cancelled leaves the previous one intact and indexed. Re-run spends the Candidate's tokens, so it is gated by `isRerunAllowed`: it is available when the newest Curation of the Profile is `failed` or `cancelled`, when no Curation of the Profile completed, or when the Profile, the Model, or the prompt version changed since the current one was produced, and refused with `curation_unchanged` otherwise.
- **The current Curation** is the latest `completed` one (`currentCompletedCurationOf`), and retrieval scopes to it explicitly. The progress poll answers the newest Curation of the Profile instead, so while a re-run is in flight the page follows the re-run while every retrieval still reads the completed one, and after a failed re-run the page shows the failure with the completed Statements still in use.
- **Serialisation.** Cancel, retry, and re-run lock the Account's Curation rows in id order and then the Account row, the order the resume observer and a runner saving a unit take them in, and the completion locks the same rows in the same order. Retry and re-run check for a `queued` or `running` Curation under those locks, so of two concurrent starts one creates and the other answers `409 curation_active`; the partial unique index is the backstop, and a violation of it answers the same.

#### Model access

`CurationModel` (a prompt in, validated structured output out) and `EmbeddingModel` are the abstractions the runner depends on; no provider SDK type crosses into a service (ADR-0004). Generation uses `@langchain/anthropic` pinned to the Model of the catalogue in `packages/shared`, with the Candidate's Model Key passed per call; embedding uses the platform key.

- `selectCurationModel` and `selectEmbeddingModel` choose the adapter from platform configuration, the way `selectCodeSender` chooses the email sender (ADR-0018). Unset outside production selects the deterministic fake: output derived from its input, valid against the shared schemas, with Evidence that resolves, a deterministic 1536-dimension vector, and a failure or a schema-invalid response on demand, so every failure path is testable without a Provider. A production configuration without the platform embedding key refuses to start.
- The code lives in `apps/api/src/curation/model/`. `selectCurationModel` reads `MODEL_ADAPTER`, the setting that also selects the Model Key check (#110): `anthropic` selects `AnthropicCurationModel`, which calls `@langchain/anthropic` with structured output (`method: "jsonSchema"`, the answer parsed again by `CurationUnitOutputSchema`) and no retries of its own, so the queue's attempts count every call; blank selects `FakeCurationModel`, outside production only. `selectEmbeddingModel` reads `EMBEDDING_API_KEY`: set, it selects `OpenAiEmbeddingModel` (`text-embedding-3-small`, 1536 dimensions); blank selects `FakeEmbeddingModel`, a unit vector drawn from the text's SHA-256 digest, outside production only. `CurationModelsModule` provides both and the worker loads it, so a production worker missing either setting refuses to start.
- The prompt (`curationMessagesOf`) keeps the instructions in the system message and puts the Candidate's text in the user message inside `<candidate_content>`, one `<source kind id>` per Experience or Project, with every look-alike of either tag in that text neutralised and the platform's facts before the block. A model answers `CurationUnitOutputSchema` from `packages/shared`: Statements whose Evidence cites a kind, an id, and a quote, never offsets, which the runner resolves against the Profile (#113).
- A call ends in a `CurationAnswer` with its token usage, or in one of three errors built from the HTTP status alone, never the Provider's message: `CurationCallFailedError` with `timeout`, `invalid_output`, `truncated_response` (a `max_tokens` stop), or `provider_error`; `ProviderRateLimitedError` (429 or 529, with `retry-after` when the Provider sends one), which pauses the Curation; and `ModelKeyRejectedError` (401 or 403). The fake plays any of them on demand, and `echo` answers with its own instructions, so a leak check can be tested.
- An Account with no Model Key never reaches the fake: its Curation is never created, and a revoked key blocks new Curations with a reason (ADR-0023).
- The Model Choice and the encrypted Model Key live in `account_model_choices`, one row per Account; the key is never returned by any endpoint, and it is checked against the Provider when it is saved (#110).
- The browser sends the Model Key straight to the API with a Model Key ticket, so the key never passes through the web app (#156). The web app's server side asks `POST /account/model/key-ticket` for one with the Session; the page presents it as the bearer token of `PUT /account/model`, the one route that accepts it and the one route CORS opens to `WEB_ORIGIN`. A ticket is single use, lives 60 seconds, and is kept only as its SHA-256 in `model_key_tickets`; the rules are in [security.md, "Keys"](security.md#keys).
- Token counts are recorded per call for the structured log line and never displayed.

#### Curation reconciliation

The [reconciliation job](#reconciliation) settles Curations with the same guarantees as Ingestions: one conditional write per row, one log line with ids only per action, and counters in its report for Curations re-enqueued, reset, and failed.

| Rule | Condition | Action |
| --- | --- | --- |
| Reset a stale run | `running`, last updated before `STALE_PROCESSING_MINUTES` (default 10), with no job that will still be delivered | back to `queued` and re-enqueued while `attempts` is below `max_attempts`, otherwise `failed` with `attempts_exhausted`, which frees the Account; either way the units it left `running` are `pending` again, in the same transaction |
| Re-enqueue an orphan | `queued` with no job that will still be delivered and no `resume_after` in the future | job added, with the Curation id as job id |
| Wait out a rate limit | `queued` with `resume_after` in the future, read from the job's `Clock` | skipped; enqueued on the first run after that time |

A worker killed mid-run would otherwise leave a `running` row for ever, and because one active Curation per Account is a unique index, that row would block every retry, every re-run, and every future Curation of the Account. The report counts `curationsReset`, `curationsFailed`, and `curationsReEnqueued`, and every action logs `reconciliation action=<reset|fail|re-enqueue> curation=<id>` and nothing else.

A Curation that runs again keeps its id as job id, and the job of its earlier attempt is still retained (a completed one for a day, a failed one until removed), which would turn the add into a no-op. `BullMqCurationQueue.enqueue` therefore removes a completed or failed job under that id before adding; a job that will still be delivered is left alone and the add stays idempotent.

#### Curation routes

Every route is Candidate-owned, and the schemas live in `packages/shared` (`CurationSchema`, `CurationUnitSchema`, `CurationProgressSchema`, `CurationMetricsSchema`, `StatementSchema`, `EvidenceSchema`, `StatementReviewSchema`, `CurationStatementsSchema`, `StatementReviewRequestSchema`, `ModelCatalogueSchema`, `AccountModelChoiceSchema`), so they reach the OpenAPI document like every other route (ADR-0022).

| Route | Answers |
| --- | --- |
| `PUT /account/model` | Stores or replaces the Model Choice and the Model Key after checking the key with the Provider; creates the Curation for a confirmed Profile that has none for its Ingestion. Takes the Session or a Model Key ticket; with neither it answers `401 model_key_ticket_invalid` |
| `POST /account/model/key-ticket` | A single-use Model Key ticket for the Session's Account and when it expires, 60 seconds on; the page presents it to `PUT /account/model` |
| `GET /account/model` | The Provider, the Model, and whether a key is stored; never the key or a fragment of it |
| `DELETE /account/model/key` | Revokes the key; the Model Choice stays and new Curations are blocked with a reason |
| `GET /profile/curation` | The current Curation, the newest one of the latest completed Profile that is not `superseded`: status, the percentage `floor(100 × saved units ÷ units)`, the total and saved counts, every unit in order with its kind, title, and status (the units being read are the `running` ones, up to three at once), the computed facts, the Model in use, and the failure reason with `resume_after`; an `ETag` over the whole answer and `304` on `If-None-Match`; `{ "progress": null }`, not a `404`, when the Account has no such Curation. Statements are not part of it |
| `POST /profile/curation/cancel` | Cancels a `queued` or `running` Curation and answers `200` with the progress; `404 curation_not_found` when none is queued or running |
| `POST /profile/curation/retry` | Re-queues a `failed` or `cancelled` Curation from its first unsaved unit and answers `202` with the progress; `409 curation_active`, `404 curation_not_found`, or `422` with `curation_not_ready`, `curation_not_retryable`, or `curation_model_changed` |
| `POST /profile/curation/rerun` | Starts a new Curation alongside the current one when the gate allows it and answers `202` with its progress; `409 curation_active`, or `422` with `curation_not_ready` or `curation_unchanged` |
| `GET /profile/curation/statements` | The Statements of the current Curation, the latest `completed` one that retrieval reads, in the order of their units, each with its text, labels, Evidence, source (the kind and title of the unit that wrote it), and review state; `{ "curationId": null, "statements": [] }` until a Curation completes. A rejected Statement is listed here and never retrieved. The answer's contract says that a review is not carried to the Statements of a re-run |
| `PUT /profile/curation/statements/:id/review` | Sets `accepted` or `rejected` with the time, or clears back to `unreviewed`, and answers the Statement; a Statement of another Account answers `404` exactly like one that does not exist |

Only `cancel`, `retry`, and `rerun` ever answer `409`, and only while a Curation is already `queued` or `running`. The percentage counts saved units only, so a fresh process answers the same number.

### AI pipeline (TC-06, TC-07)

LangChain orchestrates tool calls. Each tool wraps a NestJS service (the business logic). The pipeline starts with [Profile Curation](#profile-curation-tc-04-tc-05-tc-06), which runs once per confirmed Profile and is the only layer that reads the Profile; every layer after it runs for one Job Description and reads Statements:

```
Confirmed Profile + Model Key
   │
   ▼  one call per Curation Unit, Evidence resolved, Statements embedded
Profile Curation ──── Statements in pgvector, scoped by Account
   │
   ▼  Job Description pasted and embedded
   ▼  RAG: the Account's non-rejected Statements closest to the Job Description embedding
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

- Each layer persists its output before the next starts. The pipeline state is what tells the frontend which step is available, and no Job Description step is available until a Curation has completed.
- Every layer after Profile Curation calls RAG first and passes only the retrieved Statements to the model, never the Profile and never the extracted text (ADR-0024).
- The model is reached behind LangChain and is never referenced directly by services. Generation runs on the Account's Model Choice, `claude-sonnet-5` at Anthropic in phase one, using the Candidate's own Model Key; an Account with no Model Key blocks its analysis with a reason instead of falling back to anything (ADR-0023).
- The adapter is selected by platform configuration, not by the presence of a Model Key: unset outside production selects a deterministic fake that also stands in for the Provider when a key is validated, so CI and the local stack run the whole pipeline with no provider account; unset in production refuses to start, as the email sender does (ADR-0018, ADR-0023).
- The `model-choice` module holds the Account's Model Choice and Model Key in `account_model_choices`, one row per Account cascading from it. `PUT /account/model` checks the key through `ModelKeyValidator` (selected by `MODEL_ADAPTER`: `anthropic` retrieves the pinned model with the key, blank selects the development stand-in, which refuses `sk-ant-development-refused-key` as invalid and `sk-ant-development-unavailable-key` as unreachable), seals it with `ModelKeyCipher`, and replaces any earlier choice; a refused key replaces nothing. `GET /account/model` answers the Provider, the Model, and whether a key is stored, or `choice: null`; `DELETE /account/model/key` deletes the sealed key and keeps the choice. `ModelChoiceService.usableModelKey` is what creating a Curation asks for: the decrypted key wrapped in `ModelKey`, which prints as a placeholder, or `ModelKeyNotFoundError` with the code `model_key_missing`. `ModelKeyTicketService` issues and redeems the Model Key tickets in `model_key_tickets`, and `ModelKeyTicketGuard` resolves the Account of `PUT /account/model` from a ticket when the request carries no live Session: the route is marked with `AcceptsRouteCredential`, which is what lets the Session guard hand such a request over instead of refusing it.
- Every model call is held to the rules in [security.md, "AI pipeline"](security.md#ai-pipeline-tc-06-tc-07): where each key lives, how Candidate content is fenced off from the instructions, Account-scoped retrieval, schema-validated output, the embedding budget, and what a log line may carry.

## Data (PostgreSQL + pgvector)

One database serves both relational data and vector search.

- Relational tables for Account, Session, One-Time Code, Uploaded Resume, Ingestion, Segment, the seven Profile parts, Model Choice, Curation, Curation Unit, Statement, Job Descriptions, Learnings, and pipeline runs. Tables arrive with the task that needs them, each through a migration; `accounts`, `sessions`, `verification_tokens`, `ingestions`, and `ingestion_segments` are the first, then `uploaded_resumes`, then the Profile tables `basic_profiles`, `experiences`, `education`, `projects`, `skills`, `languages`, and `certifications`. Every Profile row carries `account_id`, `source_ingestion_id`, and `segment_id`, cascading from all three; the ordered parts keep the Segment's position and the row's position inside it; the Confidence of each field stays on the Segment's recognized output, not on the rows; and the Basic Profile row holds the confirmation time. The job queue lives in Redis (ADR-0020), and the PDF bytes in the object store (ADR-0021), never in PostgreSQL.
- The Profile Curation tables: `curations` carries `account_id` and `source_ingestion_id` and cascades from both; `curation_units` has no `account_id` of its own and is scoped through its Curation, as `ingestion_segments` is through its Ingestion; `statements` carries `account_id`, `curation_id`, `unit_id`, and `source_ingestion_id`, with the `vector(1536)` embedding, a vector index, and a partial index over the Statements that are not rejected. `curations_one_active_per_account_idx` is unique on `account_id` while the Curation is `queued` or `running`. `account_model_choices` holds one row per Account with the encrypted Model Key, and `model_key_tickets` the SHA-256 of each unspent Model Key ticket with its Account and expiry, cascading from the Account. Every read and write on them is covered by the two-Account helper under [Testing](#testing).
- The `vector` extension is enabled by the first migration, so every later migration can declare embedding columns.
- Embeddings run on one platform key at `text-embedding-3-small` into `vector(1536)`. The embedding model and its dimension are properties of the platform, not of an Account: `vector(n)` is fixed per column, so a second dimension is a new ADR and a re-embedding, never a setting (ADR-0023).
- Embeddings stored in pgvector columns alongside the rows they describe (Statements, Job Descriptions, Learnings).
- RAG queries are scoped by Account id. Retrieval across Accounts is never performed.

## Testing

| Level | Tool | Where |
| --- | --- | --- |
| Unit | Vitest | Next to the code in each app and package |
| Integration | Vitest | `apps/api` against the compose PostgreSQL, Redis, and object store, one isolated database per run; `apps/web` for the Auth.js adapter against the migrated database in `DATABASE_URL` |
| End-to-end | Playwright | `e2e/`, a workspace package; against the built web app locally, against the full stack in Docker Compose in CI |

`apps/api/src/database/testing/account-pair.ts` is the helper every module with Candidate-owned rows uses: `createAccountPair` inserts two Accounts, and `expectScopedToAccount` runs a lookup as the owner, which must answer, and as the other Account, which must answer `undefined` or throw a `*NotFoundError`. A new owned table adds one such assertion per read and write.

Integration tests need the compose `postgres`, `redis`, and `storage` services and the API's `DATABASE_URL`, `REDIS_URL`, and `S3_*` variables: `pnpm test:integration` reads them from the environment or from `apps/api/.env`. The parser's snapshot suite is unit level and runs without Docker. The API's Vitest global setup creates a database named `helpmegethired_test_<id>` on that server, migrates it to the latest version, hands its URL to the test workers, and drops it when the run ends. Test files run one at a time because they share that database. The migration test reverts and reapplies the last migration, so every migration must have a working `down`. The web app's integration project runs the Auth.js adapter against the database `DATABASE_URL` names, which must already be migrated (`pnpm db:migrate`), as CI does before the integration job.

The `e2e` package depends on `@helpmegethired/web`, so `pnpm turbo run test:e2e` builds the web app first and Playwright starts it with `next start` on port 3100. Setting `E2E_BASE_URL` points the tests at an already running stack instead, and `E2E_API_URL` (default `http://localhost:3001`) names the API for the upload scenario `resume-upload.api.spec.ts`, which signs in through the web app, reads the Session cookie, and takes a synthetic corpus PDF to a confirmed Profile and a hostile file to `failed` with its code, against the compose stack in CI. Browsers are installed once with `pnpm --filter e2e exec playwright install chromium`.

## Local runtime

Docker Compose runs the whole monorepo. `docker compose up` brings up the long-running services and two one-shot steps from the root `docker-compose.yml`. CI uses the same compose file for integration and end-to-end tests.

| Service | Image | Host port (default) | Health check |
| --- | --- | --- | --- |
| `web` | `docker/web/Dockerfile`, target `development` | `WEB_PORT` (3000) | `GET /` answers |
| `api` | `docker/api/Dockerfile`, target `development` | `API_PORT` (3001) | `GET /health` answers |
| `migrate` | same image as `api`, runs `pnpm db:migrate` and exits | none | exit code 0 |
| `postgres` | `pgvector/pgvector:pg17` | `POSTGRES_PORT` (5432) | `pg_isready` |
| `redis` | `redis:8-alpine`, `--maxmemory-policy noeviction`, append-only persistence | `REDIS_PORT` (6379) | `redis-cli ping` |
| `worker` | same image as `api`, runs `pnpm --filter api dev:worker`, 1 GB memory limit | none | the ready file the process writes once its consumers are registered exists |
| `storage` | `rustfs/rustfs`, S3 API on 9000 and the console on 9001 | `STORAGE_PORT` (9000), `STORAGE_CONSOLE_PORT` (9001) | the S3 health endpoint answers |
| `storage-init` | the S3 client image, creates the private `resumes` bucket with its CORS and exits | none | exit code 0 |
| `queue-dashboard` | `ghcr.io/felixmosh/bull-board`, pointed at `redis` | `QUEUE_DASHBOARD_PORT` (3002), bound to `127.0.0.1` | `GET /` answers |

The two dashboards are development tools: the queue dashboard shows every job of both queues with its attempts and failures, and the storage console shows the bucket. Neither is part of a deployed environment.

- Configuration comes from a root `.env`, copied from `.env.example`. Every variable is required except `AUTH_RESEND_KEY` and `EMAIL_FROM`, which are blank by default: a missing required one stops `docker compose` with a message naming it. Inside the network the services keep fixed ports (`api:3001`, `web:3000`, `postgres:5432`, `redis:6379`); the `.env` variables only choose the host ports, and `WORKER_CONCURRENCY`, `EXTRACTION_TIMEOUT_MS`, and `STALE_PROCESSING_MINUTES` tune the worker.
- The `api`, `worker`, and `migrate` containers receive `PORT`, `WEB_ORIGIN`, `DATABASE_URL`, `REDIS_URL`, and the `S3_*` variables from the compose file, so `apps/api/.env.example` is only needed when the API runs natively. Inside the network the database URL points at `postgres:5432`, the Redis URL at `redis:6379`, and `S3_ENDPOINT` at `storage:9000`; from the host they point at `localhost` with the `.env` ports. `S3_PUBLIC_ENDPOINT` is always the host address, because it is embedded in the presigned URL the browser uses.
- The `web` container receives `API_URL=http://api:3001` and starts only after `api` is healthy. When the web app runs natively, `API_URL` defaults to `http://localhost:3001`.
- The stack sends no real email. `web` receives `AUTH_RESEND_KEY` and `EMAIL_FROM` from `.env`, blank by default, so the code is printed in its logs and read from the development route; setting both in `.env` switches the local stack to Resend for a real delivery check.
- Both Dockerfiles build from the repository root: they install the workspace with pnpm filtered to the app and its workspace dependencies, build those dependencies (`packages/shared`), and run the app's `dev` script as the unprivileged `node` user. The `development` target is the only one for now; production images are a separate task.
- Hot reload: `apps/web/src` and `apps/api/src` are bind-mounted into the containers, so `next dev` and `nest start --watch` pick up edits without a rebuild. A change to dependencies, to a file outside `src`, or to `packages/shared` needs `docker compose up --build`.
- `migrate` starts once `postgres` is healthy and applies the pending migrations; `api` starts only after `migrate` has exited successfully. `docker compose up --wait` returns zero once every health check passes, which makes it the smoke test of the stack.
- Data lives in the `postgres-data` volume and survives `docker compose down`; `docker compose down --volumes` resets it. The `vector` extension ships with the image and is enabled per database by the first migration.

## CI/CD

GitHub Actions, following the Gitflow model in [workflow.md](workflow.md). Workflows live in `.github/workflows`; the steps they share (pinned Node and pnpm, `pnpm install --frozen-lockfile`, starting the compose `postgres`, `redis`, and `storage`) are composite actions under `.github/actions`.

Every workflow declares the `GITHUB_TOKEN` permissions it needs at workflow level, and no more: `CI` and `Release document` only read the repository (`contents: read`), `Release` writes to it (`contents: write`) because it creates a tag and a GitHub Release, and `Board` grants the workflow token nothing (`permissions: {}`) because it acts through `PROJECT_TOKEN`. CodeQL flags a workflow that leaves the default permissions in place.

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
- **`Release` on every push to `main`**: turns the release document that just reached production into the tag and the GitHub Release the rollback plans point at, so step 6 of the release process is not a thing anyone has to remember. It reads `docs/releases/v*.md` in version order and, for each version that has no GitHub Release yet, tags the pushed commit and publishes a Release whose notes are the document. The logic is `.github/scripts/publish-releases.sh`.

  The document stays hand-written and reviewed ([ADR-0010](adr/0010-gitflow-branching.md)); the workflow never commits to `main`. It checks every document before it creates anything, so a filename that is not `vMAJOR.MINOR.PATCH.md`, or one whose `**Tag:**` field disagrees with its filename, fails the run with nothing published; a document dated differently from the day it reached `main` is a warning, not a failure. Because it publishes only what is missing, re-running it is safe, which is also how a failed run is retried and how `workflow_dispatch` catches up a release that reached `main` before the workflow existed.
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
