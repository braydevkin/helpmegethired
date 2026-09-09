# Review instructions

## Purpose

Help Me Get Hired is a community platform that helps Candidates prepare for selection processes with AI-assisted analysis while keeping the reasoning behind each step visible and teachable.

## Architecture

- Turborepo monorepo with pnpm workspaces. `apps/*` are deployables, `packages/*` is shared code.
- `apps/web`: Next.js App Router. Components follow atomic design under `src/components` (atoms, molecules, organisms, templates); routes live under `src/app`.
- `apps/api`: NestJS, one module per domain (`auth`, `profile`, `ingestion`, `analysis`, `interview`, `queue`). PostgreSQL with pgvector through Kysely; migrations are TypeScript modules with `up` and `down` under `src/database/migrations`.
- `packages/shared`: Zod schemas and their inferred types for everything that crosses the web/api boundary. Apps never hand-write a type that a schema already defines.
- AI analysis goes through LangChain with a RAG step before every LLM call, and the analysis layers run sequentially.

## Stack

TypeScript everywhere. Next.js, NestJS, LangChain, PostgreSQL + pgvector, Kysely, Zod, Vitest, Playwright, Docker Compose, GitHub Actions. Package manager is pnpm only.

## Testing

Vitest for unit and integration (`*.test.ts`, `*.test.tsx`, next to the code), Playwright for end-to-end (`e2e/tests/*.spec.ts`). A feature without tests is not done, so flag production code in the diff that has no test change with it.

## Code style and conventions

- Clean code and SOLID: single-purpose modules, dependencies on abstractions, small functions.
- Names make comments unnecessary. A comment is only for a non-obvious why.
- Vocabulary: Candidate, Account, Profile, Resume. "User" is wrong for a Candidate.
- CSS modules with kebab-case class names; Stylelint and ESLint (`packages/eslint-config`) run in CI and enforce formatting and naming.

## Pull request rules

- One issue per pull request, referenced with `Closes #<n>`; the branch is `feature/<issue>-<slug>` or `fix/<issue>-<slug>` from `develop`.
- A change to the stack or to a documented decision needs an ADR under `docs/adr/`.
- A change in flow or behaviour updates `docs/product/requirements.md` or `docs/architecture.md`.

## What to review

- Report only findings of medium or high risk: correctness, security, data integrity, the product rules above, missing tests for changed production code, and contracts that bypass `packages/shared`.
- Each finding names the file and line and says what breaks and how to fix it.

## Out of scope

- Test files: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, and everything under `e2e/`. Do not comment on them.
- Low-risk suggestions, formatting, naming style, import order, and anything ESLint or Stylelint already enforces.
- Generated output (`dist`, `.next`, `coverage`, `.turbo`), `pnpm-lock.yaml`, and `arch/`.
- Refactoring proposals that are not tied to a defect in the diff.
