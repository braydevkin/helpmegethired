# ADR-0019: Codacy reviews production code only, gates at medium severity, and reviews once

- **Status:** Accepted
- **Date:** 2026-09-04
- **Deciders:** @braydevkin

## Context

ADR-0016 adopted Codacy Cloud with the organisation's built-in `Codacy Gate Policy`, which fails the `Codacy Static Code Analysis` check on any new issue of at least minor severity, and left the AI Reviewer's scope and trigger undefined. The first pull requests reviewed under that setup (#59, #60, #61) showed the cost: test fixtures were graded like production code, low-risk style suggestions arrived next to real defects, and it was unclear whether a push after fixing the comments would produce a new review. Issue #62 had asked for a gate at medium severity or higher; the built-in policy cannot be edited. Issue #65 refines the scope.

The forces:

- **The gate has to stop defects, not style.** A minor finding that blocks a merge trains contributors to ignore the check.
- **Tests are already linted.** `pnpm lint` runs ESLint on test files in `CI`; a second grade of the same files adds findings without adding safety, and fixtures legitimately hold literal secrets and long functions.
- **A review is a conversation, not a stream.** A reviewer that posts again on every push buries the thread that matters and makes "all comments fixed" impossible to reach.
- **Every open comment has an owner.** The value of a review comes from acting on it; a comment left open across pushes is noise for the next reader.

## Decision

Codacy reviews production code only: `.codacy.yml` excludes `*.test.ts`, `*.test.tsx`, `*.spec.ts`, and `e2e/` from every tool, and the AI Reviewer's instructions in `.codacy/instructions/review.md` put those paths out of scope.

The check gates at medium severity: a repository gate policy fails `Codacy Static Code Analysis` when a pull request introduces a new issue or a new security issue of at least medium severity; minor findings are reported and do not gate. The AI Reviewer reports medium and high risk only.

The AI Reviewer runs automatically once, when the pull request opens (`Run reviewer` set to `Automatically (first review only)`); a review after that is requested on demand with `Run Reviewer` in the pull request summary.

Every open Codacy comment of medium or higher severity on a pull request is fixed before review is requested. A comment that is not a defect is answered in its thread with the reason and the issue is ignored through the CLI with that reason; a comment is never left open. Codacy's comments are advisory for the reviewer and mandatory for the author.

## Alternatives considered

- **Keep the built-in `Codacy Gate Policy`**: zero tolerance at minor severity is what ADR-0016 recorded, but it stops pull requests on findings nobody would raise in review, and the policy cannot be edited.
- **Exclude test files from Opengrep only**: what ADR-0016 did; it handled the literal passwords but left Lizard, ESLint, and the AI Reviewer grading fixtures.
- **Run the AI Reviewer on every push**: the most complete feedback, but each run re-opens the thread and the pull request never reaches a state where every comment is handled.
- **Run the AI Reviewer manually only**: no noise, but the first review is the one that catches the most, and a review nobody asks for is a review nobody gets.
- **Fix only what fails the check**: leaves medium-risk reviewer comments open on green pull requests; the comments are the point of the reviewer.

## Consequences

- Positive: the gate fails on defects rather than on style; tests are covered by `pnpm lint` and nothing else; one reviewer thread per pull request that the author closes completely; the reviewer knows the repository's rules through a file in git.
- Negative: minor findings accumulate on `develop` without a gate, so the repository grade has to be watched on the dashboard; a minor finding in production code that a reviewer wants fixed is raised by hand; the gate policy and the reviewer trigger live in Codacy and are reproduced from `docs/architecture.md`, not from git.
- Follow-ups: the coverage upload and the diff-coverage gate keep their own issue; the pre-existing minor findings on `develop` are triaged in the issue that ADR-0016 named.
