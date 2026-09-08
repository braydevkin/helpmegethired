# ADR-0022: OpenAPI generated from the shared Zod schemas, served by Swagger UI in development

- **Status:** Accepted
- **Date:** 2026-09-07
- **Deciders:** @braydevkin

## Context

With #74 to #79 the pipeline from a PDF to a Profile exists as routes the web app calls, and nothing describes them outside the NestJS controllers. A contributor cannot review a contract without reading code, walk the routes by hand, or prove after a change that a real PDF still ends as a Profile (#83). The schemas that cross the HTTP boundary already live in `packages/shared` as Zod (ADR-0011), and Codacy runs Spectral on any OpenAPI document it finds, so a committed document is checked on every pull request (ADR-0016).

Two constraints shape the answer. The schemas must stay one source of truth: a document written by hand, or decorators repeating the shape of a Zod schema, drift the day someone changes one and not the other. And the API accepts only the Session bearer token Auth.js issues inside `apps/web` (ADR-0017); no route exchanges a One-Time Code for a token, and none is added for documentation's sake.

## Decision

**The OpenAPI 3.1 document is generated from the shared Zod schemas, committed under `apps/api/openapi/openapi.json`, checked against the code on every pull request, and served by Swagger UI at `GET /docs` outside production.**

- **One source of truth.** `apps/api/src/openapi/document.ts` declares the routes and turns every request and answer schema into JSON Schema with Zod's own `z.toJSONSchema` (request bodies as the input side, answers as the output side). No `@nestjs/swagger` decorators and no hand-written schema: a change to a shared schema changes the document.
- **Committed and checked.** `pnpm --filter @helpmegethired/api openapi` writes the document; `openapi:check` fails when the committed file differs from what the code generates, and the CI `lint` job runs it, so the two cannot drift. A unit test asserts the same and that every reference resolves, every error answer is the shared `ApiError` narrowed to the codes the route can carry, and every route but `/health` requires the Session.
- **Swagger UI in development only.** `GET /docs` renders Swagger UI from the assets the API serves itself (`swagger-ui-dist`, no CDN), `GET /docs/openapi.json` serves the document, and both answer `404` when `NODE_ENV` is `production`, as every development route does (#45). The Session is pasted as the bearer token: the value of the web app's `session` cookie after a sign in.
- **An automated twin.** The Playwright scenario `e2e/tests/resume-upload.api.spec.ts` signs in through the web app with the development code route, reads the cookie, and walks the same routes against the compose stack in CI: a synthetic corpus PDF to a confirmed Profile, a hostile file to `failed` with its code. The wiki guide "Guide: Walk the upload API" follows the same steps by hand.

## Alternatives considered

- **`@nestjs/swagger` decorators**: the usual NestJS way, rejected because every DTO would repeat a Zod schema in decorator form, a second source of truth the shared package exists to avoid.
- **A hand-written OpenAPI file**: reviewable, but nothing ties it to the code; it would be wrong within weeks.
- **A sign-in endpoint on the API for the walkthrough**: rejected; the Session stays with Auth.js (ADR-0017), and pasting the cookie value costs one step.
- **Postman or Bruno collections**: not committed; the document imports into either tool when someone wants one.

## Consequences

- Positive: a contract anyone can read and try without the web app; drift between the document and the code fails the build; Spectral reviews the document on every pull request; the scenario proves the whole pipeline end to end on every pull request.
- Negative: the route list in `document.ts` is written by hand and must be kept in step with the controllers (the unit test lists the routes, so a forgotten one is noticed); `swagger-ui-dist` adds a dependency to the API image.
- Follow-ups: document the AI pipeline routes when they arrive with their milestone; consider generating the route list from the controllers if it grows past a page.
