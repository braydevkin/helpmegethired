# Contributing

Thanks for wanting to help. This project is public and community-driven, and it is deliberately documented before it is coded. Please read this once before opening anything.

## Before you start

1. Read the [README](README.md) and [docs/product/vision.md](docs/product/vision.md) to understand what the project is for.
2. Read [docs/workflow.md](docs/workflow.md). The short version: **no task, no code**. Every change starts as a refined issue in the GitHub Project.
3. Skim [docs/architecture.md](docs/architecture.md) and the [ADRs](docs/adr/README.md) so your proposal fits the stack.

## Ways to contribute

- **Propose work**: open an issue using the templates. Explain the *why*, link to the relevant doc, and suggest acceptance criteria. A collaborator will triage it into the project.
- **Refine work**: comment on issues in `Backlog` or `Refined` state to sharpen scope and acceptance criteria.
- **Build work**: pick an issue in `Ready`, comment that you are taking it, and follow the branching rules below.
- **Improve docs**: documentation PRs are welcome without an issue when they fix inaccuracies. New documents or changed decisions still need an issue or an ADR.

Only collaborators can edit the GitHub Project board. Everyone can open issues, comment, and send pull requests.

## Stack

The stack is fixed by ADRs: Next.js, NestJS, LangChain, PostgreSQL + pgvector, Turborepo + pnpm, Vitest, Playwright, Docker, GitHub Actions, Codacy. If you think a decision should change, open an issue proposing a new ADR. Do not introduce new tooling in a feature PR.

## Local setup

The Node major is pinned in `.nvmrc` and the exact pnpm version in the `packageManager` field of `package.json`. Installs are refused on any other engine.

```sh
nvm use
pnpm install
pnpm turbo run lint typecheck test build
```

`pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` run the same pipelines individually across the whole workspace.

Integration tests and database migrations need a running PostgreSQL: start the compose one with `docker compose up --wait postgres`, copy `apps/api/.env.example` to `apps/api/.env` (or export `DATABASE_URL`), then run `pnpm test:integration` or `pnpm db:migrate`.

## Code quality

Codacy analyses every pull request in its cloud and reports `Codacy Static Code Analysis` next to the CI checks. The check fails when the pull request adds a new issue or security issue of medium or higher severity. Test files are not analysed; `pnpm lint` covers them in CI. The AI Reviewer posts one review when the pull request opens, and every open comment of medium or higher severity is fixed, or answered in its thread and ignored with a reason, before you ask for review. None stays open. The tools and their configuration are listed in [docs/architecture.md](docs/architecture.md#cicd).

Findings are on the pull request in Codacy, or in the terminal with the Codacy Cloud CLI:

```sh
pnpm add -g @codacy/codacy-cloud-cli
codacy login
codacy pull-request <n>
```

`codacy login` asks for an account API token from Codacy > My Account > Access Management. From a clone, the CLI reads the provider, organisation, and repository from the `origin` remote. If a finding is a false positive on one line, ignore it with a reason (`codacy issue <id> --ignore --ignore-reason "..."`) and say so in the pull request. A pattern is disabled only when it is wrong for the whole stack, and that change is recorded in the architecture doc.

## Branching, commits, PRs

We use **Gitflow**. `main` is production and `develop` is the test environment. Full rules in [docs/workflow.md](docs/workflow.md).

- New work: branch `feature/<issue>-<slug>` or `fix/<issue>-<slug>` from `develop`, open the PR against `develop`.
- Production emergencies: branch `hotfix/<issue>-<slug>` from `main`, open the PR against `main` with the hotfix template, then merge back into `develop`.
- Releases are PRs from `develop` to `main` and always carry a release document in `docs/releases/`. The document is added to `develop` through its own PR first; there is no `release/*` branch.
- Conventional Commits with the issue number: `feat(api): add ATS scoring service (#42)`.
- One issue per PR. Link it with `Closes #42`.
- PR descriptions are written in English using the templates in `.github/`. Fill in every section.
- CI must pass. Add tests at the right level (Vitest for unit/integration, Playwright for e2e).
- Update docs affected by your change. Add an ADR if you made a decision.

## Using Claude Code

The repository ships a `CLAUDE.md` and `.claude/settings.json`. If you use Claude Code, it will follow the same rules as you: it works from an issue, it does not commit or push without being asked, and it proposes an ADR before stepping outside the stack. Personal overrides go in `.claude/settings.local.json`, which is git-ignored. To let it read Codacy findings, install the CLI above and the `codacy-skills` plugin: `claude plugin marketplace add codacy/codacy-skills`, then `claude plugin install codacy-skills@codacy`.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
