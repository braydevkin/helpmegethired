# ADR-0013: Own credentials with hashed passwords and database-backed sessions

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

FR-01 asks for sign up and sign in, and every later feature is scoped to the authenticated Account (#10). The approach was an open decision. The forces, in the order the issue lists them:

- **Cost**: the project is a community platform with no revenue. A hosted identity provider (Auth0, Clerk, Cognito) is free only up to a user cap and then priced per monthly active user.
- **Contributor friction**: anyone should be able to run the whole stack with `docker compose up` (ADR-0007) and the end-to-end suite in CI without creating an account with a third party or handling provider keys. `.env.example` must stay complete and valid on its own.
- **Data ownership**: Candidates trust the platform with their Resume and Profile. Keeping the identity next to that data, in the same PostgreSQL, keeps one owner for all of it and avoids syncing identities between two systems.

Within "own credentials", the remaining choice is how a signed-in Account proves itself on each request: a signed stateless token (JWT) or an opaque token backed by a `sessions` row.

## Decision

`apps/api` owns the credentials: an Account is an email plus a password hashed with **scrypt** from `node:crypto`, and a signed-in Account holds an **opaque session token stored hashed in a `sessions` table**.

- Passwords are hashed with scrypt (N = 2^15, r = 8, p = 1, 16-byte random salt, 64-byte key). The parameters are stored in the hash string, so they can be raised later without invalidating existing hashes. Comparison is constant-time. No password ever reaches a log or a response.
- Sign up and sign in answer with `AuthenticatedAccountSchema` from `packages/shared`: the Account and a Session `{ token, expiresAt }`. The token is 32 random bytes; only its SHA-256 hash is stored, so a database read does not leak usable tokens.
- Clients present the token as `Authorization: Bearer <token>`. A global `SessionGuard` protects every route by default; handlers opt out with `@Public()` (health, sign up, sign in) and read the Account with `@CurrentAccount()`.
- A Session lasts 30 days. Sign out deletes the row, so revocation is immediate.
- The web app (#11) keeps the token in an HTTP-only cookie on its own origin and forwards it to the API from the server side, so the browser never handles the token in JavaScript.
- Request bodies are validated with the shared Zod schemas through `ZodValidationPipe`; a validation error names the failing fields and never echoes the submitted values.

## Alternatives considered

- **Hosted identity provider (Auth0, Clerk, Cognito, Supabase Auth)**: fastest to a polished sign-in with MFA and social login, but it introduces a paid dependency, a provider account for every contributor and CI run, and moves the identity out of the database that holds the Candidate's data. Can be revisited if the community grows past what own credentials serve well.
- **JWT access tokens**: no database read per request, but sign out cannot revoke a token before it expires without a denylist, which is a sessions table by another name. The read per request is one indexed lookup and keeps revocation simple.
- **bcrypt or argon2 packages**: both are sound, but both need native bindings in the API image. scrypt is built into Node, recommended by OWASP, and needs no dependency.
- **Cookie issued by the API**: works when the browser talks to the API directly, but in the compose stack the browser cannot reach `api:3001` and the web app calls the API from the server. A bearer token keeps the API origin-agnostic and lets the web app own its cookie.

## Consequences

- Positive: no external dependency or cost; the whole flow runs offline in Docker Compose and CI; the identity lives with the rest of the Candidate's data; sessions are revocable; hashing parameters can evolve.
- Negative: password reset, email verification, MFA, and social login must be built when needed (separate issues); every protected request costs one database read; the team owns the security of the credential store.
- Follow-ups: password reset and email verification; a periodic cleanup of expired `sessions` rows; rate limiting on sign in.
