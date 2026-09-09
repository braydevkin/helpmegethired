# ADR-0023: The Candidate's own key for generation on a pinned `claude-sonnet-5`, embeddings on one platform key

- **Status:** Accepted
- **Date:** 2026-09-09
- **Deciders:** @braydevkin

## Context

ADR-0004 put model access behind LangChain and left the provider open; ADR-0005 enabled `vector` in the first migration and left its own follow-up: define the embedding model alongside the LLM provider ADR. `docs/adr/README.md` has carried "LLM provider(s) behind LangChain" under pending decisions ever since.

Profile Curation (#101) makes the first model call in the product, so the decision can no longer wait. The embedding dimension is written into a `vector(n)` column, and `n` is fixed for the life of that column: changing it later is a migration plus a re-embedding of every Statement of every Candidate.

Three forces decide it.

- **The project cannot pay for generation.** This is a community project. One senior Profile is dozens of generation calls, and the bill grows with every Candidate who signs up. Sign up needs nothing but an email that can receive a One-Time Code (ADR-0017), so the number of Candidates is not something the project controls.
- **CI must stay green without a paid key.** `e2e/resume-upload.api.spec.ts` already drives a corpus PDF to a confirmed Profile. The moment Curation triggers on confirm, that suite starts making real provider calls unless something stands in for the provider.
- **Anthropic ships no embedding model.** A Candidate on the recommended pairing could not produce a single vector from their own key, so generation and embedding cannot be served by one credential.

## Decision

**A Candidate supplies their own key for generation against a pinned `claude-sonnet-5`; embeddings run on one platform key at `text-embedding-3-small` into `vector(1536)`; and the adapter that reaches either one is selected by platform configuration, never by the presence of a Candidate's key.**

- **Generation is the Candidate's to pay for.** Each Account holds one Model Choice — a Provider and a pinned Model — and one Model Key, the Candidate's own credential at that Provider. The Candidate is billed by the Provider directly. The platform never resells tokens and never holds a balance.
- **Phase one ships exactly one pairing: Anthropic with `claude-sonnet-5`.** #110 accepts that pairing and refuses every other with a reason. OpenAI, self-hosted OpenAI-compatible endpoints, and any second embedding dimension are later issues, so the first migration declares one dimension and one only.
- **The bare model id is the pin.** For the current generation of Claude models the id is the complete identifier: `claude-sonnet-5`, never a date-suffixed variant, because no dated snapshot exists underneath it to pin harder to. Attribution therefore rests on that id together with the prompt version, and both are recorded on every Statement. A Statement is always readable back to the model and the prompt that produced it.
- **Embeddings run on one platform key, and the model and dimension are properties of the platform, not of an Account.** `text-embedding-3-small` into `vector(1536)`. Embedding is the cheap half by orders of magnitude; generation is the half that would bankrupt the project. A second dimension is a new ADR superseding this one, not a feature this decision anticipates: `vector(n)` is fixed per column, so two dimensions mean two columns, two tables, or a partition by Account, and none of those is a configuration change.
- **The Model Key is stored encrypted at rest**, scoped to one Account, never returned by any endpoint, never written to a log line or an error payload, and revocable. Revoking it leaves the Model Choice standing (#110).
- **The adapter is selected by platform configuration, and an absent Model Key is a different thing entirely.** Two rules, not one:
  - The generation adapter is chosen by a platform environment variable, the way `selectCodeSender` chooses the email sender by configuration rather than by `NODE_ENV` name (ADR-0018). Unset outside production selects a deterministic fake, which also stands in for the Provider at the key validation step in #110, so CI and the local stack complete the whole flow with a dummy key and no account anywhere. Unset in production refuses to start, as `MissingCodeSenderError` does. A production configuration without the platform embedding key refuses to start for the same reason.
  - An Account with no Model Key **blocks its Curation with a reason the Candidate can act on**. It never falls back to the fake. A Candidate who has not supplied a key must not be shown fabricated Statements, and a product whose promise is visible, teachable reasoning cannot afford a silent stand-in in production.
- **The Model Key travels from the browser to the API and never enters the web app process.** It is not submitted through a Next.js server action or route handler. `apps/web/src/proxy.ts` is route-guard middleware and forwards no bodies, so nothing today carries it; this keeps that true.
- **Nothing about price, cost, speed or quality is displayed anywhere in this phase.** We have measured none of them. Token counts are recorded per unit for the logging #53 requires and are never shown to a Candidate.
- **The platform enforces no budget on generation, and one on embeddings.** The Candidate's Provider account is the budget for generation. Embedding is the platform's own spend, and is bounded — see Consequences. What the platform enforces besides that is a cap on attempts and a cap on per-unit input; the numbers belong to #115 and #101, which can measure them against the corpus. One active Curation per Account is not decided here: it is product rule 5, which already holds for Ingestion.

## Alternatives considered

- **A platform key for everything.** One key, no settings page, no stored Candidate credential, nothing to encrypt. Rejected: the project would pay for every Candidate's Resume analysis, which is the one cost it cannot carry.
- **Two Candidate keys**, Anthropic for generation and OpenAI for embeddings. Honest about who pays for what, and it removes the platform's spend entirely. Rejected: it doubles the friction on the first screen anyone sees, to save a cost measured in fractions of a cent.
- **Local embeddings in the worker** (ONNX, 384 dimensions). No key, no vendor, offline, and CI-friendly. Rejected for now: a larger worker image and CPU per Statement, for weaker retrieval than a hosted model. Worth reconsidering if the platform embedding cost ever becomes real.
- **Embeddings from whichever Provider the Candidate chose.** Works for OpenAI and for a self-hosted endpoint, and fails for Anthropic, which is the recommended choice and the only one phase one ships.
- **A Candidate-selectable index**, offering a standard and a high-detail dimension. This is what the settled artboard draws. Rejected: it offers a choice the platform does not have to give, since the dimension is a property of a `vector(n)` column and not of an Account.
- **Recorded cassettes instead of a fake** for the end-to-end suite. Rejected: extra machinery to record and refresh, and the fake is needed at runtime anyway for a local stack with no keys.
- **The key as the selector**, letting an absent key choose the fake so one rule covers every case. Rejected: in production that returns invented Statements to a Candidate who never supplied a key, which is the worst failure this product has.

## Consequences

- Positive: the project can afford to run. Generation scales with Candidates at no cost to the platform, CI and `docker compose up` need no provider account, the pairing is pinned so a Statement is always attributable, and the first migration declares one dimension with no re-embedding ahead of it.
- Negative: the platform stores a Candidate credential for the first time, a secret at rest with a real blast radius, so #110 is reviewed against `docs/security.md` and #53. A Candidate cannot be curated until they supply a key, which puts a provider and key step in front of the first analysis (#120). And the privacy relationship moves: the Profile text is sent to a third party under **the Candidate's own agreement with that Provider**, not under any agreement the platform holds. With a platform key that text would have been ours to govern. This is what makes the truthful retention sentence in #120 necessary rather than decorative.
- Negative: embedding is the platform's only spend and its only abuse surface. Sign up needs nothing but a reachable email, and #118 makes re-runs available on demand, so the per-Curation caps bound one Curation and not the number of them. The cost per Curation is fractions of a cent; the number of Curations is not bounded by anything today.
- Follow-ups:
  - A per-Account embedding ceiling (#133), enforced before the platform embedding key is set in any public environment. This ADR does not fix a number: the deployment target is still an open decision, so there is nowhere to measure one against.
  - `docs/adr/README.md` loses "LLM provider(s) behind LangChain" from pending decisions.
  - #53 is edited to match: its rule that the provider key lives only in the API environment and never in the web app is **preserved and now covers both keys** — the embedding key because it is an API environment variable, the Model Key because the web app never handles it server-side. Its per-Account token and cost budget is **narrowed to embeddings**, not dropped, because embedding is the platform's only spend.
  - ADR-0005's follow-up is only half discharged. It asked for the embedding model **and the chunking strategy**; the model is settled here and chunking stays open, belonging to #101 where the unit that becomes a Statement is defined.
  - Changing a Model Choice invalidates nothing automatically but makes a re-run available (#118).
