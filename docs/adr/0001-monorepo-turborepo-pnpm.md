# ADR-0001: Monorepo with Turborepo and pnpm workspaces

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

The project has a frontend, a backend, and a set of types and validation schemas that both must agree on. Keeping these in separate repositories makes the shared contract drift and makes a single change to the API touch multiple PRs.

## Decision

The project is a single monorepo managed by Turborepo with pnpm workspaces. Deployable applications live under `apps/`, shared code under `packages/`. Types and schemas that cross the HTTP boundary live in `packages/shared` and are consumed by both apps.

## Alternatives considered

- **Separate repositories**: simpler per-repo tooling, but the shared contract would be published as a package and versioned, adding friction to every API change.
- **Nx**: more features (generators, graph, caching) but more opinionated and heavier than needed for two apps and a few packages.
- **npm or yarn workspaces**: workable, but pnpm's strict node_modules layout prevents accidental undeclared dependencies and is faster.

## Consequences

- Positive: one PR can change the API contract and both consumers atomically. Turborepo caches and parallelises `build`, `lint`, `test`.
- Negative: contributors must learn pnpm and workspace filtering. CI must be workspace-aware.
- Follow-ups: define the pipeline in `turbo.json`; enforce that apps never import each other.
