# ADR-0012: Kysely as the query layer and migration tool

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

ADR-0005 fixes PostgreSQL with pgvector, but the way `apps/api` talks to it was left open. The first entity that needs a table is Account (#9, #10), and every later entity needs migrations. Three forces shape the choice:

- **pgvector**: embeddings are columns next to the rows they describe, and RAG queries use distance operators. The tool must let us declare `vector` columns and write similarity queries without fighting it.
- **Type safety**: the API is TypeScript strict; queries should be checked against the table definitions at compile time.
- **Migration ergonomics**: migrations must apply and revert (`pnpm db:migrate`, `pnpm db:migrate:down`), run from the compose stack, and be callable from the integration test setup so tests run against a freshly migrated, isolated database.

The profile ingestion queue (resumable, per-segment) and the RAG queries will need explicit SQL such as `for update skip locked` and vector distance ordering. An abstraction that hides SQL would be worked around from the start.

## Decision

`apps/api` uses **Kysely** as the query layer and Kysely's `Migrator` as the migration tool, on the `pg` driver.

- Table definitions live in `apps/api/src/database/database.schema.ts` and use the `CONTEXT.md` vocabulary in `snake_case` (`accounts`, `created_at`).
- Migrations are TypeScript modules under `apps/api/src/database/migrations/`, each exporting `up` and `down`, registered by name in the migration index. The name is a zero-padded sequence number followed by what the migration does.
- The `DatabaseModule` provides one `Kysely` instance to the whole application through the `DATABASE` token and closes its pool on shutdown. Repositories are the only classes that query; services depend on repositories.
- Repositories map rows to the shared types from `packages/shared`, so nothing outside the database layer sees column names.
- `pnpm db:migrate` and `pnpm db:migrate:down` run the migration CLI against `DATABASE_URL`. The compose stack runs the same command in a `migrate` service before `api` starts.
- Integration tests create an isolated database per run, migrate it to the latest version, and drop it afterwards.

## Alternatives considered

- **Prisma**: excellent migration workflow and generated client, but pgvector columns are `Unsupported("vector")`, every vector query is raw SQL outside the typed client, and `prisma migrate` has no down migrations. The query engine is an extra binary in the image.
- **Drizzle**: native `vector` column type and distance helpers, and a schema-as-code model that is pleasant to read. `drizzle-kit` generates SQL migrations but has no down migration, which fails the reversibility requirement, and the generated SQL files sit outside the TypeScript type checking that the rest of the API has.
- **MikroORM**: a full ORM with identity map, entities as decorated classes, and up/down migrations. It brings a unit of work and lazy loading that the domain does not need, hides the SQL the queue and RAG need, and pgvector requires a custom type.
- **TypeORM**: same trade-offs as MikroORM with weaker typing of query results and a long-standing set of open issues around strict mode.

## Consequences

- Positive: queries are type-checked against the schema; SQL stays visible where the product rules (resumable queue, RAG scoping) need it; migrations are plain TypeScript with up and down and run identically from the CLI, the compose stack, and the test setup; no code generation step or extra runtime binary.
- Negative: table interfaces are written by hand and must be kept in step with migrations; there is no relation loader, so joins are explicit; vector columns and distance operators are written with `sql` fragments.
- Follow-ups: add the `vector` column type and distance helpers when the first embedding table arrives (Job Analysis milestone); decide the queue backend (#12), which can use this layer if it is PostgreSQL-backed.
