# ADR-0026: A Job Analysis runs sequential Layers over Statements and Facts, scores by rules, and gates re-analysis instead of caching

- **Status:** Accepted
- **Date:** 2026-09-22
- **Deciders:** @braydevkin

## Context

A Candidate pastes a Job Description to learn how well they fit that one position and what to change (FR-05 to FR-07). ADR-0009 fixed that the AI layers run in sequence with retrieval first, and ADR-0024 fixed what they read: Statements, never the Profile or the extracted text. Neither decided the layers themselves, and ADR-0009's follow-up, "define the pipeline state machine", is still open for the Job Description.

`arch/job-analysis-pipeline.drawio` proposed a pipeline for it: agents called by the model, an exact cache of answers, a lease checked on demand, and an ATS score judged by the model. The refinement of 2026-09-17 kept its shape, Layers in sequence behind a queue with a checkpoint per Layer, and replaced those choices. The replacements are hard to reverse and would surprise a reader without the reasoning.

Three forces decide most of it. Every Model call is paid by the Candidate on their own Model Key (ADR-0023). A score the Candidate cannot reproduce teaches nothing, which is the product's first principle (`docs/product/vision.md`). And a Job Analysis is read long after it ran, while the Curation it read can be replaced by a new Resume at any time.

The issue is #195; the vocabulary (Job Description, Job Analysis, Layer, Requirement, Match, Strength, Weakness, ATS Score, Fact, Rebuilt Resume) is in `CONTEXT.md` since #194.

## Decision

**A Job Analysis is three Layers run strictly in sequence by code, Requirement Match, ATS Score, Resume Builder, over the current Curation's Statements and Facts. The ATS Score is calculated by a versioned rule set with no Model call, a re-analysis is gated by what changed instead of cached, and a Job Analysis keeps copies of what it cited.**

- **Layers.** Requirement Match, then ATS Score, then Resume Builder. Each persists its output before the next starts, and a retry resumes at the first unfinished Layer, never from zero (TC-04, TC-06). Orchestration stays in code, never an agent, for the reason ADR-0024 gives: every Layer must run, in order, and choosing what runs adds non-determinism to the orchestration on top of the non-determinism in generation.
- **What it reads.** Statements by retrieval, from the current Curation only and never a rejected one, and the Curation's Facts whole. Never the Profile or the extracted text (TC-08). The Facts are Years of experience and each Education, Certification, Language, and Skill of the confirmed Profile, recorded by code when a Curation completes, with no Model call. They exist because a Requirement such as "5 years of experience" or "a degree in computer science" is answered by a counted fact, not by a sentence the Model wrote about it.
- **Requirement Match.** The Model reads the Job Description, inside its delimiters, into Requirements, each required or preferred and quoted from the Job Description. A Requirement whose quote does not stand in the Job Description is dropped by code, which is how an invented Requirement is caught. The Model then answers Matches, each citing one Statement or Fact it was given, with a reason. A Match carries no number, a Match citing anything else is dropped, and a rejected Statement never supports one. A Requirement with a Match is a Strength; one without is a Weakness. A Job Description that leaves no Requirement fails the Job Analysis with a reason the Candidate can read, and is not retried.
- **ATS Score.** Calculated by a versioned rule set, with no Model call and no retrieval: a required Requirement weighs 2 and a preferred one 1, and the score is round(10 × weight of the Strengths ÷ total weight), rounded half up to an integer from 0 to 10. The rule set version is stored with the score, together with the breakdown per Requirement. It measures how much of the Job Description the Candidate's reviewed Statements and Facts cover, not how an employer's system parses a file. Because this Layer is not an AI analysis, the retrieval that ADR-0009 and TC-07 put before every AI analysis does not apply to it; it still runs in the sequence.
- **Resume Builder.** It runs on its own when the score is below 8 and is skipped at 8 or more; a skipped Layer still lets the Job Analysis complete. The Model writes a Rebuilt Resume from the Requirements, the Matches, the score breakdown, the cited Statements, those closest to the Job Description, and the Facts. Every sentence cites a Statement or a Fact it was given, otherwise it is dropped and counted, and a Weakness is never turned into a Strength. Name, e-mail, and phone never reach the Model: the Rebuilt Resume takes its header from the Account Information.
- **Re-analysis gate instead of a cache.** A new Job Analysis of a Job Description is available only when none has completed, the newest failed or was cancelled, or since the newest completed one the current Curation, a Statement review, the Model Choice, a prompt version, or the ATS rule set version changed. Otherwise the start is refused with a reason, and the Candidate reads the analysis they already have.
- **History.** A Job Analysis keeps copies of the Statements (the sentence and its Evidence quote) and Facts its output cites, so it stays readable after the Curation it read is replaced. A Job Description is kept as pasted and never edited, and it is deleted only with its Account.
- **Concurrency.**
  - one active Job Analysis per Account, enforced in the database, not by a service check (TC-05)
  - none starts while an Ingestion or a Curation is queued or running
  - an upload or a Curation re-run supersedes a running Job Analysis at its next Layer boundary, keeping the Layers it completed
- **Failures.**
  - a Layer that produces no usable output fails with its reason and is retried while attempts remain; at the limit the Job Analysis fails and names the Layer that stopped
  - a Provider rate limit pauses the Job Analysis until a time without consuming an attempt, as for a Curation (ADR-0024)
  - a refused Model Key fails the Job Analysis at once, without a retry
  - the existing reconciliation job settles a Job Analysis left running by a worker that died and re-enqueues one queued with no job, as it does for an Ingestion and a Curation (ADR-0020)
- **State.** A Job Analysis is queued, running, completed, failed, cancelled, or superseded; a Layer is pending, running, completed, failed, or skipped. This is the pipeline state machine ADR-0009 left as a follow-up, for the Job Description Layers.

Column names, route paths, refusal codes, the Layer interface, and where the prompt and rule set versions live are settled in the technical refinement of #196 to #205 and described in `docs/architecture.md` (#206).

## Alternatives considered

- **Agents the model calls as tools**, as the drawing and ADR-0004's first reading proposed. Rejected: every Layer must run, in a fixed order, and a model choosing what to call can skip one, repeat one, or reorder them, adding non-determinism to the orchestration on top of the generation (ADR-0024).
- **Parallel Layers with a merge at the end.** Faster. Rejected by ADR-0009 already, and here each Layer reads what the one before it produced: the score needs the Matches, and the Resume Builder needs the score.
- **An ATS Score judged by the Model**, or a Model-judged title match inside the rule set. Rejected: the number would change between two runs of the same input, the Candidate could not reproduce it, and it would cost a call. Counting what the Matches already established gives the same number every time and explains itself per Requirement.
- **An exact cache keyed on the Job Description and the inputs.** Saves a repeated call. Rejected: the non-determinism of the Model makes a cached answer and a fresh one differ for the same key, so a cache hides whether anything changed. The gate gives the same saving by refusing the identical re-run, and says why.
- **A lease checked on demand**, where a start finding a stale active run marks it failed. Rejected: the reconciliation job already settles stuck Ingestions and Curations on a schedule, and a second mechanism for the same failure would disagree with it.
- **Reading Profile rows directly.** Rejected by ADR-0024: Statements carry Evidence and a review, the Profile does not, and a rejected Statement would come back through the Profile.
- **Extra Curation Units for Education, Certifications, and Languages**, so they become Statements. Rejected: they are facts to count, not judgements to make, and turning them into sentences would pay the Model to restate them and risk it rewording a degree or a level. Facts recorded by code cost nothing and cannot drift.
- **A change list for the rebuilt Resume, with `before` and `after` per line.** Rejected: the Rebuilt Resume is written for the Job Description, not as edits to the Uploaded Resume, and a line-by-line diff would suggest the old text was wrong rather than aimed elsewhere.
- **Deleting a Job Analysis with the Curation it read.** Simpler storage. Rejected: the Candidate loses every analysis they ran whenever they upload a new Resume, which is exactly when they want to compare.

## Consequences

- Positive: every claim a Job Analysis makes can be followed back: Requirement → Match → Statement → Evidence → the Candidate's own Resume text. The ATS Score is reproducible and explains itself per Requirement, and a rule set change is visible by its version.
- Positive: the Candidate never pays twice for the same answer, and a failure costs at most the Layer that failed.
- Negative, what the Candidate pays for: Requirement Match's calls on every Job Analysis and, below 8, the Resume Builder's, all on their own Model Key. The ATS Score costs nothing. Retrieval embeds on the platform key within the Account's embedding ceiling (ADR-0023).
- Negative, what a re-analysis costs: the full Job Analysis again, since nothing is cached. It is available only after something it read changed, so a Candidate who wants a second opinion on unchanged input is refused and told why.
- Negative: rebuilding does not change the score. The Rebuilt Resume rests on the same Statements and Facts, so it can only present the Strengths better; raising the score needs new or reviewed Statements, which means a Curation re-run, a Statement review, or a new Resume.
- Negative: the score measures coverage of the Requirements the Model read. A Requirement the Model missed is not scored, and a Match that is wrong but cites a real Statement passes; the Candidate sees every Match with its Statement and Evidence, which is the defence.
- Follow-ups:
  - The shared schemas (#196), Facts (#197), storage (#198), pasting (#199), starting under the gate (#200), the runner (#201), reconciliation (#202), the three Layers (#203, #138, #204), and the routes (#205) implement this decision.
  - `docs/architecture.md` gains a "Job Analysis" section (#206).
  - Downloading a Rebuilt Resume needs its own decision on format and rendering (#211).

## Supersedes

None. Extends ADR-0009 (sequential AI pipeline with RAG), which gains its state machine for the Job Description Layers, and ADR-0024 (Profile Curation before every Job Description analysis), whose Statements every Layer reads. LangChain still makes each Model call (ADR-0004), but no Layer is exposed to the Model as a tool.
