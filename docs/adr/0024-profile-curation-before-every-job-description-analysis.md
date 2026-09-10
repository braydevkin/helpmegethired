# ADR-0024: Profile Curation turns a confirmed Profile into the Statements every later layer reads

- **Status:** Accepted
- **Date:** 2026-09-10
- **Deciders:** @braydevkin

## Context

Rule-based extraction gives the Profile structure but not meaning. A description that reads "reduced listing response time from 4s to 400ms by restructuring the queries" carries no dictionary term, yet it is the strongest evidence in the Resume. Splitting text by size or at blank lines makes poor retrieval units, because a fragment loses the role, the company, and the period that give it meaning. Deciding where an achievement begins and ends is a judgement about meaning.

Every AI layer in ADR-0009 runs against a Job Description. With no layer that runs once per Profile, each of them would reopen the Profile and the extracted text and pay for the same reading again. The layer that runs once and is reused by everything downstream is the cheapest place in the system to spend tokens, and since ADR-0023 those tokens are the Candidate's.

ADR-0005 left the chunking strategy open, and ADR-0023 handed it to this decision: the retrieval unit is defined here. The issue is #101; the vocabulary (Curation, Curation Unit, Statement, Evidence, Statement review) is in `CONTEXT.md`.

## Decision

**Profile Curation runs once per confirmed Profile, one model call per Curation Unit through a queue, and produces Statements with resolvable Evidence; every later AI layer retrieves those Statements and never reads the Profile or the extracted text.**

- **Trigger: a confirmed Profile and a stored Model Key, whichever comes last.** Curating fields the Candidate has not reviewed would anchor Statements in text that is about to be corrected, so nothing runs before `POST /profile/confirm`. The Model Key step opens the analysis page, after confirmation (ADR-0023): confirm creates the Curation when a key is already stored, and storing a key creates it when the Profile is already confirmed and has no Curation for its Ingestion. Confirm never requires a key and stays idempotent: a repeat answers `200`, never `409`, and creates nothing.
- **Creation in the transaction that completes the trigger**, the confirmation or the stored key. One `curations` row (`queued`) and one `curation_units` row per unit (`pending`): one unit per Experience, one per Project, one cross-cutting unit for competences that appear in more than one place, and one synthesis unit that reads what the others produced. No cap: every Experience and Project is curated. Units are derived at creation so progress has a denominator from the first second.
- **Enqueue after commit**, never inside it, because Redis does not take part in the PostgreSQL transaction. The job id is the Curation id, so every enqueue is idempotent and a failed one leaves a `queued` row for reconciliation, as with an Ingestion (ADR-0020).
- **Worker only.** The existing worker entrypoint hosts the runner; the API process registers no processor.
- **Deterministic metrics, no model.** Career duration with overlapping periods counted once, duration per company and per Project, and the counts of roles, projects, certifications, languages, and education are pure functions over the structured Profile, injected into each prompt as computed facts. The model judges; it never counts years. The existing career-length merge is reused, never reimplemented.
- **One model call per unit**, three units at a time, the synthesis unit alone after every other unit is saved. Each response is validated against a Zod schema in `packages/shared` and persisted as soon as it validates. The runner reads what is already saved and skips it, so a retry resumes at the first unsaved unit (TC-04).
- **Each unit's input is capped at 8,000 characters**, cut at a line boundary, and the unit records that it was truncated. The cap bounds abnormal input, not a Resume: in the thirty-Resume corpus the longest whole text is 1,965 characters and the largest single Experience or Project 665.
- **Orchestration stays in code.** A structured chain, not an agent: an agent choosing what to read adds non-determinism to the orchestration on top of the non-determinism in generation, and every unit must always run.
- **Statements are the retrieval unit.** A Statement is a self-contained sentence that reads correctly with nothing around it, carrying Evidence (a pointer to the Experience, Project, or span of extracted text it was drawn from), labels for filtering before retrieval, the prompt version, the Model, and `source_ingestion_id`. A Statement whose Evidence does not resolve against the Account's Profile is discarded and never saved, which is how a hallucination is caught by code rather than by trust. The version fields exist because the output is non-deterministic and kept indefinitely; without them an improved prompt can never be told apart from the one an already-curated Candidate ran on.
- **Embedding at the end.** Once every unit is saved, the Statements are embedded on the platform key into pgvector, scoped by Account (ADR-0023). The extracted text stays where it is as an auditable fallback and no later layer reads it.
- **Completion.** The runner writes `completed` before returning, so the queue never believes the work is done while the row says `running`.
- **Failure.** A timeout, invalid JSON, a response that fails the schema, and a truncated response are one event: the call produced no usable output. The reason is recorded on the unit row, never on the queue. `attempts` is incremented in the write that moves the row to `running`, before any work, so a run killed without reporting still counts; `max_attempts` is 3, as for an Ingestion.
- **A Provider rate limit is not a failure.** A rate limit or an exhausted quota at the Candidate's Provider says nothing about the input, so it sets `resume_after` and returns the Curation to `queued` without consuming an attempt; reconciliation enqueues it once that time has passed.
- **One active Curation per Account** is a partial unique index on `account_id where status in ('queued', 'running')`, not a service check (TC-05).
- **Terminal states** are `completed`, `failed`, `cancelled`, and `superseded`; all four free the Account.
- **Invalidation.** A new Ingestion supersedes the current Curation and deletes its Statements and embeddings in the transaction that replaces the Profile rows. Curation is not restarted by itself: it waits for the next confirm, and the Job Description steps stay locked until then. A re-run builds a new Curation alongside the current one, which stays readable, and replaces it when it completes, as an Ingestion replaces a Profile.
- **The Job Description steps require a completed Curation**, because no later layer reads anything else.

## Alternatives considered

- **Retrieval straight over the extracted text, chunked by size.** No model cost in this layer, and what most implementations do. Rejected: a chunk loses role, company, and period, so retrieval returns fragments that cannot be judged, and there is no Evidence to reject a hallucination against.
- **Curating on demand, once per Job Description.** Nothing to build ahead and nothing to invalidate. Rejected: the same reading is paid for on every application, and the Candidate waits for it every time.
- **One model call for the whole Profile.** The simplest runner. Rejected: a failure on the tenth Experience throws away nine that already cost the Candidate money, and nothing can resume.
- **An agent that decides which parts to read.** Rejected: non-determinism in orchestration on top of non-determinism in generation, with no guarantee every unit runs.
- **Triggering on Ingestion completion instead of confirm.** Faster for the Candidate. Rejected: it curates fields the Candidate is about to correct and indexes them as if they were true.

## Consequences

- Positive: the Profile is read by a model once, and every Job Description layer retrieves a few Statements instead of the Profile (TC-07). A failure costs at most one unit's call, and a retry costs only what was not saved. Every Statement is traceable to the text that justifies it and to the Model and prompt that wrote it.
- Negative: a Candidate cannot reach the Job Description steps until a Curation completes, and cannot start one without a Model Key. A Curation is between 2 and 8 calls for the corpus (median 4) and grows with the Profile, since there is no cap. Improving a prompt reaches an already-curated Candidate only through a re-run, which the Candidate pays for, so re-runs are gated (#118).
- Negative: the output is non-deterministic, and a Statement that is wrong but cites real Evidence passes the check. The Candidate's Statement review is the only defence against it (#119).
- Follow-ups:
  - Every later AI layer reads Statements and never the Profile or the extracted text, recorded as a technical constraint in `docs/product/requirements.md` (#104) so it binds layers not yet designed.
  - `docs/architecture.md` gains a "Profile Curation" section, and its "AI pipeline" starts from Statements (#105).
  - The chunking half of ADR-0005's follow-up is discharged: the retrieval unit is the Statement. ADR-0009's pipeline state machine now has its first layer.
  - The rules every model call is held to (delimiters, Account-scoped retrieval, schema-validated output, logging without content) are `docs/security.md`, "AI pipeline" (#53).

## Supersedes

None. Extends ADR-0009 (sequential AI pipeline with RAG) and ADR-0004 (LangChain orchestration); the retrieval index it builds is the one ADR-0005 anticipated.
