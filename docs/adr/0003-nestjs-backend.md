# ADR-0003: NestJS for the backend

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

The backend hosts authentication, domain entities, a queue-based ingestion pipeline, and the AI services that LangChain tools call. It needs clear module boundaries, dependency injection, and first-class TypeScript.

## Decision

The backend is a NestJS application in `apps/api`. Modules mirror the domain (auth, profile, ingestion, job-descriptions, analysis, learnings, interview). AI tools wrap NestJS services rather than containing logic themselves.

## Alternatives considered

- **Express or Fastify directly**: less structure; module boundaries and DI would have to be invented.
- **Next.js API routes**: would couple backend and frontend deployments and make queue workers awkward.
- **Non-TypeScript backend (e.g. Python for AI proximity)**: would break shared types with the frontend, which is a core requirement.

## Consequences

- Positive: opinionated structure keeps a community codebase consistent; DI makes services testable with Vitest.
- Negative: NestJS carries decorators and some ceremony; contributors need to learn its conventions.
- Follow-ups: choose the ORM/query layer (pending ADR).
