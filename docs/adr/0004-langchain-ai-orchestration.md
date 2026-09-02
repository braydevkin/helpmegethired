# ADR-0004: LangChain for AI orchestration

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

The product runs a chain of AI analyses (ATS level, resume builder, learnings, study plan, apply helper, mock interview). Each needs RAG retrieval, prompt management, and tool calling against backend services. The LLM provider should be swappable.

## Decision

LangChain (TypeScript) orchestrates the AI pipeline inside `apps/api`. Business logic lives in NestJS services; LangChain tools are thin wrappers that call those services. The LLM provider is configured through LangChain and never referenced directly by services.

## Alternatives considered

- **Direct provider SDK calls**: simplest, but RAG, tool calling, and provider abstraction would be rebuilt by hand.
- **Vercel AI SDK**: strong on streaming UI, weaker as a backend orchestration layer for multi-step pipelines with retrieval.
- **LlamaIndex**: good for RAG, less mature for tool orchestration in TypeScript at the time of decision.

## Consequences

- Positive: retrieval, prompts, and tools use one framework; provider can change without touching services.
- Negative: framework abstractions can hide token usage and latency; observability must be added deliberately.
- Follow-ups: choose the LLM provider (pending ADR); add tracing for every chain run.
