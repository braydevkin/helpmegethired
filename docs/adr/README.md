# Architecture Decision Records

An ADR records one decision, its context, and its consequences. ADRs are immutable once accepted; to change a decision, write a new ADR that supersedes the old one.

Use [template.md](template.md). Number sequentially. Status is one of `Proposed`, `Accepted`, `Superseded by ADR-XXXX`, `Deprecated`.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-monorepo-turborepo-pnpm.md) | Monorepo with Turborepo and pnpm workspaces | Accepted |
| [0002](0002-nextjs-frontend.md) | Next.js for the frontend | Accepted |
| [0003](0003-nestjs-backend.md) | NestJS for the backend | Accepted |
| [0004](0004-langchain-ai-orchestration.md) | LangChain for AI orchestration | Accepted |
| [0005](0005-postgres-pgvector-rag.md) | PostgreSQL with pgvector for data and RAG | Accepted |
| [0006](0006-testing-vitest-playwright.md) | Vitest for unit/integration, Playwright for end-to-end | Accepted |
| [0007](0007-docker-local-runtime.md) | Docker Compose runs the whole monorepo | Accepted |
| [0008](0008-github-actions-and-projects.md) | GitHub Actions for CI/CD, GitHub Projects for tasks | Accepted |
| [0009](0009-sequential-ai-pipeline-with-rag.md) | Sequential AI pipeline with RAG before every analysis | Accepted |
| [0010](0010-gitflow-branching.md) | Gitflow branching with main as production and develop as test | Accepted |
| [0011](0011-zod-shared-schemas.md) | Zod for shared schemas and inferred types | Accepted |
| [0012](0012-kysely-query-layer-and-migrations.md) | Kysely as the query layer and migration tool | Accepted |

## Pending decisions

Not yet decided. Each becomes an ADR when resolved.

- **License** for the repository.
- **LLM provider(s)** behind LangChain.
- **Queue backend** for profile ingestion (for example BullMQ on Redis, or PostgreSQL-backed).
- **Deployment target** for `main` builds.
- **LinkedIn data access** approach and fallback.
