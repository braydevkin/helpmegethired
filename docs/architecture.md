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
│                                   ┌──────────────────────────┐    │
│                                   │ PostgreSQL + pgvector    │    │
│                                   │  relational data + RAG   │    │
│                                   └──────────────────────────┘    │
│                                                ▲                  │
│                                   ┌────────────┴─────────────┐    │
│                                   │ pg-boss queue (in api)   │    │
│                                   └──────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

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
- Unit and component tests run on Vitest with a jsdom environment and Testing Library, next to the code as `*.test.tsx`.
- Linting combines the shared configuration with the Next.js plugin (`core-web-vitals`) and the React Hooks plugin.
- Pages follow the application flow: sign up and sign in, then the journey (upload resume, LinkedIn URL, profile page, job description, analysis, resume recommendations, study recommendations, mock interview, summary).
- Because steps are sequential (TC-06), the UI exposes a step as available only when the backend reports the previous step complete. The UI never decides step order on its own.
- Profile-building progress (TC-04) is shown as a percentage, driven by backend state.

### Components follow atomic design (ADR-0015)

Shared components live under `src/components`, in one folder per stage of [atomic design](https://atomicdesign.bradfrost.com/chapter-2/); pages are the `page.tsx` files under `src/app`:

```
apps/web/src/
├── app/                      pages: page.tsx with real content, route groups and layout.tsx
└── components/
    ├── atoms/                button, text input, label, eyebrow, error message, progress bar
    ├── molecules/            field with label, hint and error; code input; phone field
    ├── organisms/            email form, code form, identity form, brand panel
    └── templates/            account template: brand panel beside the centred form column
```

- A stage imports only from the stages below it: atoms import nothing under `components/`, molecules import atoms, organisms import molecules and atoms, templates import organisms and below. Only pages touch the API client, the Session, and server actions; components receive what they need as props. An ESLint rule in `apps/web` enforces the direction (#32).
- A route group `layout.tsx` renders a template from `components/templates/`, so the template is a plain component that Vitest renders without the router. Frost's template is not the App Router's reserved `template.tsx`.
- One folder per component, kebab-case, with the component and its test inside: `components/molecules/code-input/code-input.tsx` and `code-input.test.tsx`. Imports use the full path to the file; there are no barrel `index.ts` files.
- `"use client"` sits on the lowest stage that needs browser state. Design tokens are CSS custom properties in `globals.css`, not components.
- The design pages in the [GitHub Wiki](https://github.com/braydevkin/helpmegethired/wiki) list the components of each screen by stage, and the review checks the tree against that list.

### Account pages and the Session cookie (FR-01)

The web app is the only client of the API, and it talks to it from the server side, so the browser never handles the Session token:

- `/sign-up` and `/sign-in` render one `CredentialsForm`. The form parses the fields with `CredentialsSchema` from `packages/shared` before anything is sent and shows each issue next to its field; only an accepted body reaches the server action. The server action calls the API through `AuthClient` and answers the form with the API message (duplicate email, wrong password) or redirects to `/journey`.
- On success the action stores the API Session token in a cookie named `session`: HTTP-only, `SameSite=Lax`, `Path=/`, `Secure` in production, expiring with the Session. Server components and actions read it with `readSessionToken()` and send it to the API as `Authorization: Bearer`.
- `/journey` is the first authenticated page. It asks the API for the Account behind the cookie and redirects to `/sign-in` when the API no longer accepts the token. Sign out is a server action that revokes the Session at the API, clears the cookie, and redirects to `/sign-in`.
- `src/proxy.ts` handles the redirects before a page renders: an authenticated path without the cookie goes to `/sign-in`; the forms with a cookie go to `/journey` when the API still accepts the token, and otherwise the stale cookie is cleared and the form is shown.
- The API origin comes from `API_URL`, read on the server only, defaulting to `http://localhost:3001` for a native `next dev`. The compose stack sets it to `http://api:3001`.

## Backend (apps/api)

- NestJS modules mirror the domain:
  - `auth` (Account, authorization)
  - `profile` (Basic Profile, Experiences, Projects)
  - `ingestion` (resume PDF parsing, LinkedIn reading, segment queue)
  - `job-descriptions` (store, embed)
  - `analysis` (the sequential AI pipeline)
  - `learnings` (store, study plans)
  - `interview` (mock interview)
- Authorization is enforced at the module boundary. A Candidate can only read and write their own entities.
- Configuration comes from environment variables, validated at startup by a Zod schema in `apps/api/src/config`. A missing or invalid variable stops the process with a message naming the variable. The variables and their defaults are listed in `apps/api/.env.example`.
- `GET /health` reports the application status. Its response shape is `HealthStatusSchema` in `packages/shared`, so the web app and the end-to-end tests validate it against the same contract.
- Tests live next to the code: `*.test.ts` files are unit tests (`pnpm test`), `*.integration.test.ts` files boot the application against a real database (`pnpm test:integration`, see [Testing](#testing)).

### Authentication (FR-01)

The `auth` module owns Accounts and Sessions, following ADR-0013:

- `POST /auth/sign-up` and `POST /auth/sign-in` take `CredentialsSchema` and answer with `AuthenticatedAccountSchema`: the Account plus a Session `{ token, expiresAt }`. Sign up rejects an email that already has an Account with `409`; sign in rejects a wrong password or an unknown email with the same `401`.
- Passwords are hashed with scrypt behind the `PasswordHasher` abstraction. The Session token is random, stored only as a SHA-256 hash, and lasts 30 days.
- `SessionGuard` is registered globally, so every route requires `Authorization: Bearer <token>` unless its handler or controller carries `@Public()`. Handlers receive the signed-in Account through `@CurrentAccount()`. `POST /auth/sign-out` deletes the Session; `GET /auth/account` returns the Account behind the token.
- Request bodies are validated with the shared Zod schemas through `ZodValidationPipe`. A failed validation answers `400` with `ApiErrorSchema`, whose `issues` name the fields without echoing the values.

### Database access

The database layer lives in `apps/api/src/database` and follows ADR-0012:

- `database.schema.ts` declares every table as a Kysely interface. Table and column names follow [CONTEXT.md](../CONTEXT.md) in `snake_case`.
- `DatabaseModule` is global. It builds one `Kysely` instance from `DATABASE_URL`, exposes it through the `DATABASE` token, and closes the pool on shutdown.
- Repositories (for example `AccountRepository` in `auth`) are the only classes that query. They map rows to the types from `packages/shared`, so services and controllers never see column names.
- `migrations/` holds one TypeScript module per migration with `up` and `down`, registered in `migrations/index.ts`. `migrator.ts` wraps Kysely's `Migrator`; `migrate.cli.ts` is the command behind `pnpm db:migrate` and `pnpm db:migrate:down`, which Turbo runs after building the API and its workspace dependencies. The first migration enables the `vector` extension and creates `accounts`; the second adds the password hash and creates `sessions`; the third creates `ingestions` and `ingestion_segments`.

### Profile ingestion (TC-03, TC-04, TC-05)

Profile building is an **Ingestion**: one run for one Account from one source, split into ordered **Segments**, each of which goes through three **Steps**. The vocabulary is in [CONTEXT.md](../CONTEXT.md); the queue decision is ADR-0014. The `ingestion` module holds the state machine and its persistence; the first real segment processors (Resume PDF, LinkedIn) arrive with their own tasks.

```
start ──▶ ingestions (queued) + ingestion_segments (pending) + pg-boss job, one transaction
                                                                    │
                          worker: run(ingestionId) ◀────────────────┘
                                   │
                  for each Segment not yet saved, from its last completed Step:
                     read ──▶ recognize ──▶ save        (each Step persisted as it completes)
                                   │
                  all saved ──▶ completed
                  a Step throws ──▶ Segment keeps its last completed Step + error
                                    Ingestion: attempts < max ? queued (pg-boss retries) : failed
```

**Ingestion states.** `queued` (waiting for a worker, on the first attempt or after a failed one), `running` (a worker is processing it), `failed` (every attempt used; the Candidate may start a new Ingestion), `completed`. Every attempt increments `attempts`; `max_attempts` (3) is stored on the row and sent to pg-boss as its retry limit, so the queue and the row agree.

**Segment states.** A Segment's status is the last Step it completed: `pending`, `read`, `recognized`, `saved`. The output of `read` and `recognize` is persisted on the Segment (`content`, `recognized`) so a retry continues with the next Step instead of recomputing. A Step that throws records the message on the Segment (`last_error`) and stops the run; the Segment's status does not move.

**Resuming.** A retry calls the same `run(ingestionId)`. The runner walks the Segments in `position` order, skips the ones already `saved`, and for the others executes only the Steps after the persisted status. Nothing already completed is redone.

**Progress.** `progressOf(ingestionId)` reads the Ingestion status and the status of every Segment and answers `IngestionProgressSchema`: the percentage is `floor(100 × completed Steps ÷ (3 × Segments))`, plus the total and saved Segment counts. Nothing in memory contributes; a fresh process answers the same number.

**One active Ingestion per Account.** The partial unique index `ingestions_one_active_per_account_idx` on `account_id where status in ('queued', 'running')` enforces it in the database. `start` inserts the Ingestion, its Segments, and the pg-boss job in one transaction and maps the unique violation to `IngestionAlreadyActiveError`; if the job cannot be sent, nothing is kept and the Account stays free. A `completed` or `failed` Ingestion frees the Account. A worker that dies leaves the row `running` until pg-boss expires the job and re-delivers it; a heartbeat for long attempts is a follow-up in ADR-0014.

**Processors.** A `SegmentProcessor` implements `read`, `recognize`, and `save` for one Segment `kind`; the `SegmentProcessorRegistry` resolves the processor by kind. No real processor is registered yet; the tests use a scripted one.

**Queue.** `IngestionQueue` is the abstraction (`enqueue`, `work`); `PgBossIngestionQueue` implements it on the `profile-ingestion` queue with a one-second polling interval and exponential backoff between retries. The `QueueModule` provides the `PgBoss` instance on the Kysely connection, starts it with the module, and stops it gracefully on shutdown. pg-boss keeps its tables in the `pgboss` schema, which it migrates on start.

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

- Relational tables for Account, Session, Ingestion, Segment, Basic Profile, Experiences, Projects, Job Descriptions, Learnings, and pipeline runs. Tables arrive with the task that needs them, each through a migration; `accounts`, `sessions`, `ingestions`, and `ingestion_segments` are the first. The `pgboss` schema holds the job queue and is managed by pg-boss (ADR-0014).
- The `vector` extension is enabled by the first migration, so every later migration can declare embedding columns.
- Embeddings stored in pgvector columns alongside the rows they describe (profile chunks, job description chunks, learnings).
- RAG queries are scoped by Account id. Retrieval across Accounts is never performed.

## Testing

| Level | Tool | Where |
| --- | --- | --- |
| Unit | Vitest | Next to the code in each app and package |
| Integration | Vitest | `apps/api` against a real PostgreSQL in Docker, one isolated database per run |
| End-to-end | Playwright | `e2e/`, a workspace package; against the built web app locally, against the full stack in Docker Compose in CI |

Integration tests need the compose `postgres` service and the `DATABASE_URL` of the API: `pnpm test:integration` reads it from the environment or from `apps/api/.env`. The Vitest global setup creates a database named `helpmegethired_test_<id>` on that server, migrates it to the latest version, hands its URL to the test workers, and drops it when the run ends. Test files run one at a time because they share that database. The migration test reverts and reapplies the last migration, so every migration must have a working `down`.

The `e2e` package depends on `@helpmegethired/web`, so `pnpm turbo run test:e2e` builds the web app first and Playwright starts it with `next start` on port 3100. Setting `E2E_BASE_URL` points the tests at an already running stack instead. Browsers are installed once with `pnpm --filter e2e exec playwright install chromium`.

## Local runtime

Docker Compose runs the whole monorepo. `docker compose up` brings up three long-running services and one migration step from the root `docker-compose.yml`. The job queue runs inside `api` on PostgreSQL (ADR-0014), so no queue service is needed. CI uses the same compose file for integration and end-to-end tests.

| Service | Image | Host port (default) | Health check |
| --- | --- | --- | --- |
| `web` | `docker/web/Dockerfile`, target `development` | `WEB_PORT` (3000) | `GET /` answers |
| `api` | `docker/api/Dockerfile`, target `development` | `API_PORT` (3001) | `GET /health` answers |
| `migrate` | same image as `api`, runs `pnpm db:migrate` and exits | none | exit code 0 |
| `postgres` | `pgvector/pgvector:pg17` | `POSTGRES_PORT` (5432) | `pg_isready` |

- Configuration comes from a root `.env`, copied from `.env.example`. Every variable is required: a missing one stops `docker compose` with a message naming it. Inside the network the services keep fixed ports (`api:3001`, `web:3000`, `postgres:5432`); the `.env` variables only choose the host ports.
- The `api` and `migrate` containers receive `PORT`, `WEB_ORIGIN`, and `DATABASE_URL` from the compose file, so `apps/api/.env.example` is only needed when the API runs natively. Inside the network the database URL points at `postgres:5432`; from the host it points at `localhost:${POSTGRES_PORT}`.
- The `web` container receives `API_URL=http://api:3001` and starts only after `api` is healthy. When the web app runs natively, `API_URL` defaults to `http://localhost:3001`.
- Both Dockerfiles build from the repository root: they install the workspace with pnpm filtered to the app and its workspace dependencies, build those dependencies (`packages/shared`), and run the app's `dev` script as the unprivileged `node` user. The `development` target is the only one for now; production images are a separate task.
- Hot reload: `apps/web/src` and `apps/api/src` are bind-mounted into the containers, so `next dev` and `nest start --watch` pick up edits without a rebuild. A change to dependencies, to a file outside `src`, or to `packages/shared` needs `docker compose up --build`.
- `migrate` starts once `postgres` is healthy and applies the pending migrations; `api` starts only after `migrate` has exited successfully. `docker compose up --wait` returns zero once every health check passes, which makes it the smoke test of the stack.
- Data lives in the `postgres-data` volume and survives `docker compose down`; `docker compose down --volumes` resets it. The `vector` extension ships with the image and is enabled per database by the first migration.

## CI/CD

GitHub Actions, following the Gitflow model in [workflow.md](workflow.md). Workflows live in `.github/workflows`; the steps they share (pinned Node and pnpm, `pnpm install --frozen-lockfile`, starting the compose `postgres`) are composite actions under `.github/actions`.

Every workflow declares the `GITHUB_TOKEN` permissions it needs at workflow level, and no more: `CI` and `Release document` only read the repository (`contents: read`), and `Board` grants the workflow token nothing (`permissions: {}`) because it acts through `PROJECT_TOKEN`. CodeQL flags a workflow that leaves the default permissions in place.

- **`CI` on every pull request to `develop` or `main`**: five checks, one job each, so a failure names the level that broke.

  | Check | Command | Needs |
  | --- | --- | --- |
  | `lint` | `pnpm lint` | |
  | `typecheck` | `pnpm typecheck` | |
  | `unit` | `pnpm test` | |
  | `integration` | `pnpm db:migrate`, `pnpm db:migrate:down`, `pnpm db:migrate`, then `pnpm test:integration` | compose `postgres` started from `.env.example` |
  | `e2e` | `pnpm --filter e2e test:e2e` with `E2E_BASE_URL` pointing at the stack | `docker compose up --build --wait` from `.env.example` |

  `.env.example` is the configuration in CI, so it must stay complete and valid. A new run for the same pull request cancels the previous one.
- **`Release document` on every pull request to `main`**: fails unless the pull request adds or changes a `docs/releases/vX.Y.Z.md`.
- **`Codacy Static Code Analysis` on every pull request and on every push to `develop` and `main`** ([ADR-0016](adr/0016-codacy-static-analysis.md)): Codacy Cloud analyses the commit in its own cloud, triggered by the repository webhook, and reports the result as a commit status. No workflow, secret, or CI minute is involved, so the check also runs on pull requests from forks. It fails when the pull request introduces at least one new issue (the organisation's default `Codacy Gate Policy`); complexity, duplication, and coverage are reported but do not gate.

  | Tool | Looks at | Configuration |
  | --- | --- | --- |
  | ESLint 9 | TypeScript and JavaScript | The repository's `eslint.config.*` files, so the findings match `pnpm lint` |
  | Opengrep | Security and secrets, every language (Semgrep rules) | Codacy defaults minus two patterns; `*.test.ts`, `*.test.tsx`, and `e2e/` excluded in `.codacy.yml` because fixtures hold literal passwords |
  | Trivy | Vulnerable dependencies | Codacy defaults |
  | Checkov | Docker Compose and GitHub Actions | Codacy defaults |
  | Hadolint | Dockerfiles | Codacy defaults |
  | Lizard | Function length and cyclomatic complexity | Codacy defaults |
  | PMD 7 | JavaScript | Codacy defaults |
  | Stylelint | CSS | Codacy defaults minus the SCSS-only patterns |
  | markdownlint | Markdown | Codacy defaults |
  | Spectral | OpenAPI documents | Codacy defaults |
  | Jackson Linter | JSON | Codacy defaults |

  `.codacy.yml` at the root holds what the repository can express itself: paths excluded from every tool (`pnpm-lock.yaml`, `arch/`, build output) and the per-tool exclusions. Four settings live in Codacy and are reproduced with the Codacy Cloud CLI from a clone of the repository:

  ```sh
  codacy tool Agentlinter --disable
  codacy pattern Stylelint Stylelint_scss_function-disallowed-list --disable
  codacy pattern Stylelint Stylelint_scss_selector-class-pattern --disable
  codacy pattern Opengrep Semgrep_json.npm.security.package-dependencies-check.package-dependencies-check --disable
  codacy pattern Opengrep Semgrep_generic.secrets.gitleaks.hashicorp-tf-password.hashicorp-tf-password --disable
  ```

  Agentlinter grades `CLAUDE.md` as an agent prompt, which is not code quality. The two Stylelint patterns are SCSS rules that report "unknown rule" on every plain CSS file. The dependency-versions pattern flags every caret range in a `package.json` while `pnpm-lock.yaml` already pins what `CI` installs with `--frozen-lockfile`. The Terraform password pattern matches the `password` autocomplete attributes of the sign-in form. A false positive on a single line is ignored with a reason (`codacy issue <id> --ignore --ignore-reason "..."`) rather than by disabling its pattern. `codacy tools` and `codacy patterns <tool> --enabled` list the live configuration.
- **`Board` on pull request and issue events**: keeps the project board in step with GitHub activity (see [workflow.md](workflow.md), "Task lifecycle"). A pull request that is opened, reopened, marked ready for review, or edited moves itself and every issue it closes (`Closes #n`) to **In review**; a merged pull request moves them to **Done**; a closed issue moves to **Done**. Draft pull requests and pull requests closed without merging move nothing. The logic is `.github/scripts/board.js`, run with `actions/github-script`. It needs a `PROJECT_TOKEN` repository secret: a personal access token of a collaborator with `project` scope (classic) or read and write access to the project (fine-grained), because the workflow token cannot edit a project board. The workflow runs on `pull_request_target`, so it always executes the script from the base branch and works for pull requests from forks.
- **Branch protection**: `main` and `develop` require the five `CI` checks and `Codacy Static Code Analysis`; `main` also requires `Release document`.
- **On merge to `develop`**: build images and deploy to the **test environment**. Pending the deployment target decision.
- **On merge to `main`**: build images, tag `vX.Y.Z`, publish a GitHub Release from the release document, and deploy to **production**. Pending the deployment target decision.

## Open decisions

Tracked in [docs/adr/README.md](adr/README.md) under "Pending".
