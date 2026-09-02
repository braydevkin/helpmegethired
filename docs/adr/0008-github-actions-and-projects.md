# ADR-0008: GitHub Actions for CI/CD, GitHub Projects for tasks

- **Status:** Accepted
- **Date:** 2026-09-02
- **Deciders:** @braydevkin

## Context

The repository is public and community-driven. Work needs a single visible place to be defined and refined, and every PR needs automated checks. Only collaborators should be able to change the task board.

## Decision

GitHub Actions runs lint, typecheck, unit, integration, and end-to-end tests on every pull request and builds images on merge to `main`. GitHub Projects is the only place where tasks are defined; only collaborators edit it. No task, no code.

## Alternatives considered

- **External trackers (Jira, Linear)**: more features, but move the work away from where the code and community are, and add access management.
- **Other CI (CircleCI, GitLab CI)**: no advantage for a GitHub-hosted public repo.

## Consequences

- Positive: everything is in one place and visible to the public; issue and PR templates enforce refinement.
- Negative: GitHub Projects automation is limited; some board hygiene is manual.
- Follow-ups: create the project board with the lifecycle columns from `docs/workflow.md`; protect `main`.
