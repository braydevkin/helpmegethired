# ADR-0005: PostgreSQL with pgvector for data and RAG

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

The product needs relational storage for accounts, profiles, experiences, projects, job descriptions, learnings, ingestion state, and pipeline runs. It also needs vector similarity search for RAG, scoped per user. A requirement (TC-07) is that RAG runs before any AI analysis.

## Decision

One PostgreSQL database with the pgvector extension stores both relational data and embeddings. Embeddings live next to the rows they describe. All retrieval queries are scoped by user id.

## Alternatives considered

- **Dedicated vector database (Pinecone, Qdrant, Weaviate)**: better at very large scale, but adds a second data store, a second source of truth, and a second thing to run in Docker for a project at this size.
- **SQLite**: no comparable vector support and not suited to concurrent queue workers.

## Consequences

- Positive: one datastore, transactional consistency between entities and their embeddings, trivial per-user scoping via SQL.
- Negative: pgvector performance needs index tuning at scale; the team must own that.
- Follow-ups: define the embedding model and chunking strategy alongside the LLM provider ADR.
