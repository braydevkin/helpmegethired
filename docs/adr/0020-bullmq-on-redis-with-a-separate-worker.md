# ADR-0020: BullMQ on Redis with a separate worker for the ingestion queues

- **Status:** Accepted
- **Date:** 2026-09-06
- **Deciders:** @braydevkin
- **Supersedes:** ADR-0014

## Context

ADR-0014 chose pg-boss inside `apps/api` so that the queue added no service to the compose stack and every job was a row next to the Segment state. Since then the Resume upload and extraction pipeline was designed (#71, [Design: Resume Upload](https://github.com/braydevkin/helpmegethired/wiki/Design-Resume-Upload)) and it changes the work the queue carries:

- **CPU-bound work in the request process.** Extraction runs `pdftotext` on a file the Candidate chose, with a timeout and a memory limit (#52). Inside the API it competes with every request for the event loop and the container's memory, and a hung or hostile PDF degrades the whole API. The work must run in a process that can be sized, limited, and restarted on its own.
- **Bounded concurrency and a heartbeat.** ADR-0014 left as a follow-up "give a running attempt a heartbeat so a job re-delivered after the expiration cannot overlap a worker that is still alive". A Segment run or an extraction can legitimately take minutes; the queue has to tell a slow worker from a dead one, and a worker has to process a fixed number of jobs at a time.
- **Two queues, one pipeline.** The extraction of one Uploaded Resume and the profile building of one Ingestion are separate jobs with separate retry policies, and the first one creates the second.
- **Observability.** ADR-0014 rejected Redis partly because "jobs must be inspectable with the tools the team has". That force still holds and is answered below.

pg-boss could grow into this with a second process polling the same tables, but its polling latency, its lack of a lock heartbeat, and the absence of a dashboard mean building around it what BullMQ provides.

## Decision

**The ingestion queues run on BullMQ over Redis, consumed by a separate `worker` service built from the API image. The API process only enqueues.**

- **Redis** is the official `redis:8-alpine` image, started with `--maxmemory-policy noeviction` because BullMQ refuses to lose keys, with append-only persistence and a health check. Its URL reaches the API and the worker as `REDIS_URL`, validated at boot. Redis 8 returned to an open-source licence (AGPLv3 among its tri-licence); Valkey is a drop-in should that ever matter.
- **Two queues**: `resume-extraction` with one job per Uploaded Resume, and `profile-ingestion` with one job per Ingestion. The job id is the record id, so adding a job twice is a no-op, and every processor starts by reading what is already persisted and skipping it: re-delivery is always safe. Attempts come from the row (`max_attempts`), backoff is exponential, and failed jobs are kept for inspection.
- **The worker** is a second Nest entrypoint in `apps/api` (`worker.ts`) that hosts every processor with a concurrency of `WORKER_CONCURRENCY` (default 4) and a memory limit in compose. The API registers no processor. BullMQ's lock heartbeat marks a job stalled when its worker dies and re-delivers it; a slow worker keeps its lock.
- **The enqueue happens after the PostgreSQL transaction commits**, never inside it. A failed enqueue is logged and the request still succeeds, because the **reconciliation job** on the worker (every five minutes, one instance through a fixed repeat key) re-enqueues any `uploaded` record, `processing` record, or `queued` or `running` Ingestion that has no waiting or active job, expires abandoned uploads, promotes silent ones, and cleans the bucket. The state machine converges even when Redis loses its data.
- **The `IngestionQueue` abstraction stays.** `BullMqIngestionQueue` replaces `PgBossIngestionQueue`; the runner, the Segment state machine, and their tests do not change. The `pgboss` schema and dependency are removed.
- **bull-board** runs as the `queue-dashboard` compose service from its official image, pointed at the same Redis, so queues, jobs, attempts, and failures are inspectable in a browser locally. It never ships to production without an authentication decision of its own.

## Alternatives considered

- **Keep pg-boss and add a second process**: the queue stays in PostgreSQL, but pg-boss has no lock heartbeat, polls with up to one second of latency, and offers no dashboard; every force above would be built by hand around it.
- **Graphile Worker**: PostgreSQL-backed with `LISTEN/NOTIFY`, but it has the same lack of heartbeat and dashboard, and its task-file API fits the NestJS module shape worse than pg-boss did.
- **A hand-written queue on `for update skip locked`**: full control and no dependency, at the price of writing polling, backoff, stalled detection, and a dashboard.
- **Valkey instead of Redis**: BSD-licensed and supported by BullMQ. Redis is what BullMQ documents and tests first; the swap is one image name in compose and is recorded here as the fallback.

## Consequences

- Positive: extraction runs in its own process with bounded concurrency and a memory limit; a dead worker is detected by the heartbeat, not by a timeout; the API stays responsive under hostile input; the two queues carry different retry policies; bull-board shows every job.
- Negative: Redis joins the compose stack, CI, and every deployment target; the enqueue is not transactional with the row, so the reconciliation job is mandatory, not optional; job state and Segment state are two records in two stores.
- Follow-ups: authentication in front of bull-board before any deployed environment exposes it; the Redis deployment for the test and production environments once the deployment target is decided.
