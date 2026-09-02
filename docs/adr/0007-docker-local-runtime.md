# ADR-0007: Docker Compose runs the whole monorepo

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

Contributors need to run web, api, PostgreSQL with pgvector, and a queue backend locally with one command, and CI needs the same stack for integration and end-to-end tests.

## Decision

A root `docker-compose.yml` runs the whole monorepo. Dockerfiles live under `docker/`. CI uses the same compose file so local and CI environments match.

## Alternatives considered

- **Run services natively**: faster iteration for some, but pgvector and a queue backend become manual setup steps that drift between machines.
- **Dev containers only**: useful, but does not cover CI.

## Consequences

- Positive: one command to run everything; parity between local and CI.
- Negative: Docker on some machines (WSL2, Apple Silicon) needs care; hot reload inside containers must be configured.
- Follow-ups: document `.env.example`; support running apps natively against Dockerised infra as an option.
