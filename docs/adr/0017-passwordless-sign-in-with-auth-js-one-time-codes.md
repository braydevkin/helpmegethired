# ADR-0017: Passwordless sign in with Auth.js one-time email codes

- **Status:** Accepted
- **Date:** 2026-09-03
- **Deciders:** @braydevkin

## Context

The Account design (#29, [Design: Account](https://github.com/braydevkin/helpmegethired/wiki/Design-Account) in the wiki) has no passwords: a Candidate types an email, receives a 6-digit code that expires in 10 minutes, and is signed in after verifying it. Sign up and sign in share the same two screens; sign up adds an identity step (name, last name, phone with country code, optional address). The maintainer's system design on that page takes the technical decision: Auth.js runs the code flow and the Session in `apps/web`, Resend delivers the email, and the Session lasts 12 hours.

ADR-0013 chose own credentials: a password hashed by the API with scrypt and a 30 day Session. Its forces still hold and shaped this decision:

- **Cost and contributor friction**: no paid identity provider, and `docker compose up` plus CI must run the whole flow without a third-party account or key.
- **Data ownership**: the identity stays in the same PostgreSQL as the Candidate's Profile.
- **The API keeps guarding its routes**: every protected request still presents `Authorization: Bearer <token>` and `SessionGuard` still validates it against the `sessions` table (#30).

What changes is who issues the Session. A one-time code flow needs token generation, hashed storage with expiry, single use, email delivery, and the sign-in callback. Auth.js provides exactly that as an email provider, and its Next.js binding handles the cookie.

## Decision

**Auth.js (`next-auth` v5 with `@auth/core`) in `apps/web` runs the one-time code flow and opens the Session. The API validates the same Session token and stores the Account information.**

- **A custom email provider** (`email-code`) generates a 6-digit code with `crypto.randomInt` instead of a magic-link token and gives it a 10 minute expiry. Auth.js stores only the hash of the code, salted with `AUTH_SECRET`, in `verification_tokens`. A code is used once: verifying it deletes the row. Sending a new code deletes the previous one for that email, so only the last code sent is valid.
- **Delivery goes through a `CodeSender` abstraction.** The development sender logs the code and keeps the last code per email in memory; a development-only route (`GET /development/verification-code?email=`) exposes it so Playwright can finish the flow, and answers 404 in production. Production refuses to start without a real sender; the Resend sender arrives with #31.
- **Our own Kysely adapter** (`AccountAdapter`) maps Auth.js onto our tables and vocabulary: its "user" is the `accounts` row, the Candidate's identity; provider links do not exist. It hashes the Session token with SHA-256 before storing it in `sessions.token_hash`, exactly as ADR-0013 stored API-issued tokens, so the API's `SessionGuard` and `SessionRepository` keep working unchanged and a database read never leaks a usable token. `apps/web` therefore reads `DATABASE_URL`; migrations stay in `apps/api`.
- **Sessions are database sessions of 12 hours** from sign in, not refreshed on activity (`updateAge` equals `maxAge`). The cookie keeps the name `session` and the options ADR-0013 defined: HTTP-only, `SameSite=Lax`, `Secure` in production, expiring with the Session. Server code forwards it to the API as a bearer token. Sign out calls the API, which deletes the row.
- **Both steps are server actions, no `/api/auth/*` route.** Sending the code calls Auth.js's `signIn` helper in-process. Verifying the code calls `Auth()` in raw mode against the provider callback URL and copies the resulting cookies onto the response, so the code never travels in a browser URL and a wrong, expired, or used code is reported inline by the same message. Without the route handler there is no Auth.js sign-in page, session endpoint, or CSRF endpoint to expose.
- **Known and unknown emails behave the same.** Sending a code never reveals whether an Account exists; the first verified code creates the Account. A signed-in Account without a name is sent to the account information step by the frontend tasks (#33, #34).
- **The identity step is an API call.** `PATCH /auth/account` takes `AccountInformationSchema` (name, last name, phone with a dial code from the fixed list, optional address) and stores it on the Account; `GET /auth/account` returns it. The password endpoints, `PasswordHasher`, `PasswordSchema`, and `CredentialsSchema` are removed.

## Alternatives considered

- **Keep own credentials and add a code flow by hand**: the API already had sessions and hashing, so the code table, expiry, single use, and callback could be written in NestJS. Auth.js provides all of it, tested, with the cookie handling for Next.js, and the flow then lives where the pages are; the API keeps only what it needs to guard routes. Writing it again would be the larger, riskier change.
- **The official `@auth/kysely-adapter`**: it expects Auth.js's own table names and columns (`User`, `Session.sessionToken` in clear text) and pins Kysely 0.28 while the API runs 0.29. Our adapter is small, keeps the vocabulary of `CONTEXT.md`, and keeps tokens hashed.
- **JWT sessions in Auth.js**: no database read per request, but sign out could not revoke a Session and the API would need to verify Auth.js's JWE. Database sessions keep one source of truth that both apps read.
- **Magic links instead of codes**: Auth.js's default, but the design asks for a code typed on the same device, which works when the email is read on a phone and the sign in happens on a laptop.
- **Exposing the Auth.js route handler and verifying by redirect**: the standard setup, but it puts the code in the browser's URL and history, and errors land on a redirect page instead of inline in the form.

## Consequences

- Positive: no passwords to store, reset, or leak; sign up and sign in are one flow; the API's guard and Session table are untouched; the whole flow runs in Docker Compose and CI with no provider key; the web app owns the Session it sets.
- Negative: `apps/web` now connects to PostgreSQL and needs `AUTH_SECRET` and `DATABASE_URL`; the Session cookie is written by Auth.js, so its behaviour follows Auth.js's releases (v5 is still a beta); a 6-digit code has one million values, so rate limiting is needed before the platform is exposed publicly; the code is logged in development configuration by design.
- Follow-ups: the Resend sender and the production startup check (#31); the redesigned pages and the account information step (#32, #33, #34); rate limiting on sending and verifying codes by IP and by email; a periodic cleanup of expired `sessions` and `verification_tokens` rows; ADR-0013 is superseded by this decision.
