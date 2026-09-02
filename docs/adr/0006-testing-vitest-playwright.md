# ADR-0006: Vitest for unit/integration, Playwright for end-to-end

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

The project needs fast unit tests in every package, integration tests for the API against a real database, and end-to-end tests that exercise the sequential candidate journey through the browser.

## Decision

Vitest is used for unit and integration tests in every app and package. Playwright is used for end-to-end tests in `e2e/` against the full stack running in Docker Compose. A feature is not done without tests at the appropriate level.

## Alternatives considered

- **Jest**: the NestJS default, but slower and needs extra configuration for ESM and TypeScript; Vitest shares config with the Vite ecosystem.
- **Cypress**: mature, but Playwright has better multi-browser support and runs faster in CI.

## Consequences

- Positive: one test runner across the monorepo; e2e tests validate the sequential flow that unit tests cannot.
- Negative: NestJS examples in the wild use Jest, so some adaptation is needed.
- Follow-ups: set up integration tests against Dockerised PostgreSQL; decide e2e data seeding strategy.
