# ADR-0002: Next.js for the frontend

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

The frontend is a multi-step, mostly form-driven journey with authenticated pages and some server-rendered content such as the profile page. It must integrate with a separate NestJS API.

## Decision

The frontend is a Next.js application using the App Router and TypeScript, living in `apps/web`. It talks to the backend over HTTP using the schemas from `packages/shared`.

## Alternatives considered

- **Vite + React SPA**: lighter, but loses server rendering, routing conventions, and the ecosystem around authentication and data fetching.
- **Remix**: comparable, smaller community and less familiarity in the team.

## Consequences

- Positive: conventional routing, server components where useful, wide contributor familiarity.
- Negative: App Router has its own mental model; contributors must follow the project's conventions for client vs server components.
- Follow-ups: decide on the data fetching and form validation approach; both must reuse shared schemas.
