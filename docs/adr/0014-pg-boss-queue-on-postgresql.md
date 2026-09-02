# ADR-0014: pg-boss on PostgreSQL as the queue backend for profile ingestion

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

TC-03, TC-04, and TC-05 in `docs/product/requirements.md` define how a Profile is built: by Segment, through a queue, resumable after a failure with visible progress, and with at most one active Ingestion per Candidate (#12). The queue backend was a pending decision. The forces, in the order the issue lists them:

- **Resumability**: a failed run must continue from the first incomplete Segment, never from zero, and progress must be readable at any moment. That state belongs to the application, not to the queue: the queue only needs to deliver "run this Ingestion" reliably, retry it after a failure, and recover it when a worker dies mid-run.
- **Observability**: jobs, their attempts, and their failures must be inspectable with the tools the team already has.
- **One fewer service**: the compose stack (ADR-0007) runs `web`, `api`, `migrate`, and `postgres`. Every extra service is one more thing to install, monitor, and keep healthy in CI.

## Decision

Profile ingestion uses **pg-boss** as its job queue, running inside `apps/api` on the existing PostgreSQL through the Kysely connection (ADR-0012). No new service joins the compose stack.

- The `QueueModule` builds one `PgBoss` instance on top of the `DATABASE` Kysely instance (`fromKysely`), starts it when the module initialises, and stops it gracefully on shutdown. pg-boss owns the `pgboss` schema and migrates it on start; the application migrations never touch it.
- The Ingestion state lives in the application's own tables, `ingestions` and `ingestion_segments`, declared in `database.schema.ts` and created by an application migration. Progress is computed from those rows, never from an in-memory counter.
- One pg-boss job per Ingestion on the `profile-ingestion` queue, sent in the same transaction that inserts the Ingestion and its Segments (pg-boss accepts the Kysely transaction through its adapter), so a row never exists without its job. The job carries the Ingestion id; its `retryLimit` is the Ingestion's `max_attempts - 1`, so the queue and the row agree on how many attempts exist. A failed attempt throws, pg-boss retries it with backoff, and the next attempt resumes from the first incomplete Segment step.
- The `ingestion` module depends on the `IngestionQueue` abstraction (`enqueue`, `work`). `PgBossIngestionQueue` is the only implementation; tests substitute a recording queue to exercise the state machine deterministically and run one test through the real queue.
- A worker crash leaves the job `active` until pg-boss expires it (15 minutes by default) and retries it; the Ingestion row stays `running` meanwhile and the single-active rule keeps holding.

## Alternatives considered

- **BullMQ on Redis**: mature, fast, with a rich dashboard, but it adds Redis to the compose stack, to CI, and to every deployment target, and its job state lives outside the database that holds the Segment state the product needs to read. Fails "one fewer service".
- **A hand-written queue on `for update skip locked`**: no dependency and full control, and ADR-0012 anticipated it. It would have to grow its own polling loop, retry policy with backoff, expiration of jobs whose worker died, and inspection tooling. pg-boss provides exactly that on the same PostgreSQL for one dependency with no native bindings.
- **Graphile Worker**: also PostgreSQL-backed and solid, with lower latency through `LISTEN/NOTIFY`. Its migrations are driven by a CLI and its API centres on task files; pg-boss fits the module-and-provider shape of NestJS with less ceremony and shares the Kysely connection through an official adapter.

## Consequences

- Positive: no new service anywhere; jobs and their history are rows in the same database and can be inspected with SQL; retries, backoff, and expiration of dead workers come for free; the Ingestion state machine stays in application code and is tested without the queue.
- Negative: polling adds up to one second of latency before a worker picks a job; the `pgboss` schema is managed by a library, so a pg-boss upgrade can migrate it on start; jobs and Segment state are two records that describe one run and must be kept coherent by the runner.
- Follow-ups: expose progress through an endpoint for the frontend; add the first real `SegmentProcessor` (Resume PDF); allow a Candidate to resume an Ingestion whose attempts are exhausted; give a running attempt a heartbeat so a job re-delivered after the pg-boss expiration cannot overlap a worker that is still alive.
