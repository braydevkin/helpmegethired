# ADR-0010: Gitflow branching with main as production and develop as test

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

The project will run two environments: a test environment for integrating and validating work, and production for candidates. Work arrives from many contributors as small PRs. Production needs a clear audit trail of what went out, when, and how to roll it back. Emergencies must be fixable without shipping whatever is currently being tested.

## Decision

The repository follows Gitflow with two long-lived branches and three short-lived branch types:

- `main` is production. Every merge is a tagged, documented release.
- `develop` is the test environment and the default branch. Feature and fix PRs target it.
- `feature/<issue>-<slug>` and `fix/<issue>-<slug>` branch from `develop` and merge into `develop`.
- `hotfix/<issue>-<slug>` branches from `main`, merges into `main`, and is merged back into `develop` immediately.
- A release is a PR from `develop` to `main`. Dedicated `release/*` branches are not used; stabilisation happens in `develop` and the test environment.

Every PR to `main` carries a release document in `docs/releases/vX.Y.Z.md`. All PR descriptions are written in English using the templates in `.github/`.

## Alternatives considered

- **Trunk-based development with feature flags**: fewer branches and faster integration, but requires a mature flag system and continuous deployment to production, which the project does not have yet. Can be revisited once CI/CD and observability are in place.
- **GitHub Flow (main only, deploy from branches)**: simple, but gives no stable integration branch for a shared test environment.
- **Full Gitflow with `release/*` branches**: adds a stabilisation branch per release. Overhead not justified while `develop` and the test environment already serve that purpose.

## Consequences

- Positive: production history is a sequence of documented releases; the test environment always reflects `develop`; hotfixes do not drag unreleased work into production.
- Negative: two protected branches to maintain; hotfixes require a back-merge that is easy to forget; `develop` can drift from `main` if releases are infrequent.
- Follow-ups: protect `main` and `develop`; set `develop` as the default branch; add a CI check that a PR to `main` includes a release document; add a CI job that deploys `develop` to test and `main` to production.
