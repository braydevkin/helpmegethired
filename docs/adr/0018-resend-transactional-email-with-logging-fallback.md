# ADR-0018: Resend delivers transactional email, the logging sender is the local fallback

- **Status:** Accepted
- **Date:** 2026-09-03
- **Deciders:** @braydevkin

## Context

ADR-0017 moved sign in to one-time codes sent by email and left delivery behind the `CodeSender` abstraction: #30 shipped a development sender that logs the code and keeps the last one per email for the end-to-end tests, and made production refuse to start without a real sender. The Account system design ([Design: Account](https://github.com/braydevkin/helpmegethired/wiki/Design-Account)) names Resend as the provider. #31 adds that sender.

The forces from ADR-0013 and ADR-0017 still apply: no paid service for contributors, `docker compose up` and CI must run the whole flow with no third-party account or key, and nothing sensitive may reach the repository. Two more come with email:

- **Deliverability**: a code that lands in spam or arrives after its 10 minute expiry breaks sign in. The sender address must belong to a domain the provider has verified, so it cannot be a default baked into the code.
- **The rendered email is part of the design.** The Account design defines the tokens and the type; the email follows them, but email clients ignore stylesheets and web fonts, so Manrope is not embedded and the styles are inlined.

## Decision

**Resend delivers the one-time code email through its HTTP API, selected by `AUTH_RESEND_KEY`; without the key the logging sender from #30 stays in place, and a production configuration refuses to start.**

- **`ResendCodeSender` posts to `https://api.resend.com/emails` with `fetch`**, authenticated by `AUTH_RESEND_KEY`. No SDK is added: the sender needs one endpoint, the injected `fetch` is what the unit tests stub, and the dependency list stays as it was. A non-2xx answer becomes a `CodeEmailRejectedError` naming the status and Resend's message, which Auth.js reports as a failed send and the form shows as "We could not send your code".
- **The sender address comes from `EMAIL_FROM`**, a bare address or `Name <address>`, on a domain verified in Resend. It has no default and is required whenever `AUTH_RESEND_KEY` is set; `readAuthEnvironment` enforces both and treats blank values as unset, so the compose file can pass the variables through empty.
- **Selection is by configuration, not by environment name.** `AUTH_RESEND_KEY` set: Resend, in every `NODE_ENV`, so a maintainer can verify real delivery from the local stack. Not set: the `DevelopmentCodeSender` outside production, and `MissingCodeSenderError` in production, whose message names the two variables to set.
- **The email exists in plain text and HTML**, rendered by `renderCodeEmail` from the code alone. The subject carries the code so it is readable from a notification. The HTML is a single table with the design tokens inlined (`ink`, `text-muted`, `brand`, `accent`, `border`, `field-readonly`) and the family `Manrope, ui-sans-serif, system-ui, sans-serif` without embedding the font.
- **The local stack keeps the logging sender; no SMTP catcher is added.** `.env.example` ships `AUTH_RESEND_KEY` and `EMAIL_FROM` blank, so `docker compose up` and the CI end-to-end job print the code in the `web` logs and expose it at `GET /development/verification-code?email=`, exactly as #30 left them. No real email leaves the local stack unless a contributor sets a key on purpose.

## Alternatives considered

- **The `resend` npm package**: a typed client for one endpoint we call with five fields. It would be a new dependency to track for a request the unit tests stub anyway; the HTTP call is small enough to own.
- **Auth.js's built-in Resend provider**: it sends a magic link, not a code, and would bypass the `CodeSender` abstraction that keeps the logging sender and the tests working. The custom provider from ADR-0017 stays.
- **SMTP through Nodemailer, with Resend's SMTP relay in production**: one transport for every environment and a local catcher for free, but a new dependency and a second delivery path Resend treats as secondary. The HTTP API is Resend's primary interface and needs nothing installed.
- **A local SMTP catcher (Mailpit or MailHog) in Docker Compose**: it shows the rendered email in a browser, but only over SMTP, a transport this project does not use, so it would exercise a different sender than production. The rendered email is covered by unit tests and a maintainer can send a real one by setting the key locally; a catcher can be added later if seeing the email in the local stack becomes a need.

## Consequences

- Positive: production sign in works with two variables; the local stack, CI, and contributors need no Resend account; the sender abstraction from #30 is unchanged; no dependency is added; the email follows the design tokens and degrades to the system font.
- Negative: delivery depends on a third-party service and on the domain verification done in Resend's dashboard, outside the repository; the HTML template is maintained by hand without a preview in the local stack; a rejected send is reported to the Candidate only as "try again", with the detail in the server logs.
- Follow-ups: verify the sending domain and set `AUTH_RESEND_KEY` and `EMAIL_FROM` in the test and production environments once the deployment target is decided; rate limiting on sending codes (ADR-0017) matters more now that each send costs a provider call; revisit the catcher if the team wants to see the rendered email locally.
