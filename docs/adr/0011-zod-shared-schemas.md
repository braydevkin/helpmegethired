# ADR-0011: Zod for shared schemas and inferred types

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

`packages/shared` owns every type and validation schema that crosses the HTTP boundary (ADR-0001). Writing a TypeScript type and a separate runtime validator for each entity doubles the surface that can drift. The package needs one library that:

- runs unchanged in Next.js (server and client bundles) and in NestJS;
- infers the static type from the schema so the type is never written twice;
- validates at runtime with readable errors that both apps can return to the Candidate.

Issue #4 tracks the decision.

## Decision

Schemas in `packages/shared` are written with Zod. Every exported schema is accompanied by its inferred type (`type Account = z.infer<typeof AccountSchema>`), and apps validate request and response payloads against the schema instead of hand-written checks. Zod is pinned in the pnpm catalog so both apps and the shared package resolve the same version.

## Alternatives considered

- **Valibot**: smaller bundle through tree-shakeable functions, but a younger ecosystem, a less familiar pipe-based API, and no direct NestJS integration. Bundle size is not a constraint for this project.
- **TypeBox**: emits JSON Schema natively, which is useful for OpenAPI, but validation goes through a separate compiler step and the type-level ergonomics for unions and refinements are weaker.
- **class-validator + class-transformer**: the NestJS default, but decorators on classes cannot be shared with a Next.js client bundle cleanly and give no type inference.
- **Hand-written types with no runtime validation**: nothing stops an app from trusting a malformed payload.

## Consequences

- Positive: one source of truth per entity; the NestJS validation pipe and the Next.js forms consume the same schema; JSON Schema can still be produced from Zod when OpenAPI is needed.
- Negative: Zod's inferred types can be verbose in error messages; refinements are not expressible in generated JSON Schema.
- Follow-ups: a NestJS validation pipe built on Zod when `apps/api` is scaffolded; persistence mapping of these schemas is #9.
