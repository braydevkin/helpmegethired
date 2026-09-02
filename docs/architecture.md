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
│                                   │ Queue (profile building) │    │
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
├── docker/                 # Dockerfiles and compose support files (#7)
├── docs/                   # This documentation
├── arch/                   # Diagrams
├── .github/                # Workflows, issue and PR templates
├── docker-compose.yml      # (#7)
├── .nvmrc
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

Entries marked with an issue number are added by that task; everything else exists.

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
- Pages follow the application flow: sign in, upload resume, LinkedIn URL, profile page, job description, analysis, resume recommendations, study recommendations, mock interview, summary.
- Because steps are sequential (TC-06), the UI exposes a step as available only when the backend reports the previous step complete. The UI never decides step order on its own.
- Profile-building progress (TC-04) is shown as a percentage, driven by backend state.

## Backend (apps/api)

- NestJS modules mirror the domain:
  - `auth` (Account, authorization)
  - `profile` (Basic Profile, Experiences, Projects)
  - `ingestion` (resume PDF parsing, LinkedIn reading, segment queue)
  - `job-descriptions` (store, embed)
  - `analysis` (the sequential AI pipeline)
  - `learnings` (store, study plans)
  - `interview` (mock interview)
- Authorization is enforced at the module boundary. A user can only read and write their own entities.
- Configuration comes from environment variables, validated at startup by a Zod schema in `apps/api/src/config`. A missing or invalid variable stops the process with a message naming the variable. The variables and their defaults are listed in `apps/api/.env.example`.
- `GET /health` reports the application status. Its response shape is `HealthStatusSchema` in `packages/shared`, so the web app and the end-to-end tests validate it against the same contract.
- Tests live next to the code: `*.test.ts` files are unit tests, `*.integration.test.ts` files boot the application. `vitest run --project unit` or `--project integration` runs one level on its own.

### Profile ingestion (TC-03, TC-04, TC-05)

Ingestion is a queue-based pipeline that processes the profile **by segment**:

```
upload ──▶ enqueue segments ──▶ [read] ──▶ [recognize] ──▶ [save] ──▶ progress %
                                   │                           │
                                   └──── on failure: retry from the failed segment ────┘
```

- Each segment (for example: basic info, one experience, one project) is a unit of work with its own state.
- State is persisted per segment, so a crash resumes from the first incomplete segment.
- A user has at most one active ingestion. A new upload while one is active is rejected.

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

- Relational tables for Account, Basic Profile, Experiences, Projects, Job Descriptions, Learnings, ingestion segments, and pipeline runs.
- Embeddings stored in pgvector columns alongside the rows they describe (profile chunks, job description chunks, learnings).
- RAG queries are scoped by user id. Cross-user retrieval is never performed.

## Testing

| Level | Tool | Where |
| --- | --- | --- |
| Unit | Vitest | Next to the code in each app and package |
| Integration | Vitest | `apps/api` against a real PostgreSQL in Docker |
| End-to-end | Playwright | `e2e/`, a workspace package; against the built web app locally, against the full stack in Docker Compose in CI |

The `e2e` package depends on `@helpmegethired/web`, so `pnpm turbo run test:e2e` builds the web app first and Playwright starts it with `next start` on port 3100. Setting `E2E_BASE_URL` points the tests at an already running stack instead. Browsers are installed once with `pnpm --filter e2e exec playwright install chromium`.

## Local runtime

Docker Compose runs the whole monorepo: web, api, PostgreSQL with pgvector, and the queue backend. A single command brings the stack up. CI uses the same compose file for integration and end-to-end tests.

## CI/CD

GitHub Actions, following the Gitflow model in [workflow.md](workflow.md):

- **On any pull request**: install, lint, typecheck, unit tests, integration tests, e2e tests.
- **On pull request to `main`**: additionally verify that a release document exists under `docs/releases/` for the version being released.
- **On merge to `develop`**: build images and deploy to the **test environment**.
- **On merge to `main`**: build images, tag `vX.Y.Z`, publish a GitHub Release from the release document, and deploy to **production**. Deployment target is an open decision.

## Open decisions

Tracked in [docs/adr/README.md](adr/README.md) under "Pending".
