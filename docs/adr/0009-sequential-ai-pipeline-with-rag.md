# ADR-0009: Sequential AI pipeline with RAG before every analysis

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

The product's value is that each analysis builds on the previous one and the candidate sees each step complete. Running layers in parallel would make results inconsistent and hide the reasoning. Sending full profiles to the LLM on every step would waste tokens. The product definition sets constraints TC-06 (sequential layers) and TC-07 (RAG before analysis).

## Decision

AI analysis layers run strictly in sequence. Each layer persists its output before the next starts, and the persisted pipeline state is what the frontend uses to unlock steps. Every layer performs RAG retrieval from pgvector first and passes only the retrieved context to the LLM.

## Alternatives considered

- **Parallel layers with a final merge**: faster, but breaks the product's teaching model and makes partial progress meaningless.
- **Full-context prompts without RAG**: simpler, but token cost grows with profile size and contradicts TC-07.

## Consequences

- Positive: predictable cost, explainable steps, resumable pipeline runs.
- Negative: total latency is the sum of the layers; the UI must communicate progress well.
- Follow-ups: define the pipeline state machine and its persistence in the analysis module.
