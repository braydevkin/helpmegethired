# ADR-0016: Codacy Cloud for static analysis and quality gates

- **Status:** Accepted
- **Date:** 2026-09-04
- **Deciders:** @braydevkin

## Context

`CI` runs ESLint, the type checker, and the three test levels on every pull request, and CodeQL default setup runs GitHub's security queries. Nothing measures complexity or duplication per pull request, nothing scans for secrets, vulnerable dependencies, or misconfigured Compose and workflow files, and the findings that do exist are spread over the Actions log and the Security tab. A reviewer has no single place to see what a change did to the quality of the code.

A SonarQube workflow reached `develop` on 2026-09-03 and was reverted the same day (#55): it was not driven by a task, had no ADR, and needed a `SONAR_TOKEN` secret that pull requests from forks cannot read. Issue #62 reopens the question properly.

The forces:

- **The repository is public and community-driven.** Contributors arrive from forks, so a check that depends on a repository secret is a check that only collaborators get.
- **The stack already lints.** `packages/eslint-config` is the source of truth for the rules; a second tool with its own ESLint rules would produce two answers to the same question.
- **Findings must be readable where the work happens.** `docs/workflow.md` puts Claude Code in the loop for every task; a tool whose results live only in a web UI is not part of that loop.
- **No task, no code.** A code-quality tool is a stack change, and the stack changes only through an ADR.

## Decision

Codacy Cloud analyses every pull request and every push to `develop` and `main`, and reports the result as the `Codacy Static Code Analysis` commit status, which is required for merging. Analysis runs in Codacy's cloud from the repository webhook: no workflow, secret, or CI minute is involved, so pull requests from forks get the same check as everyone else.

The check fails when a pull request introduces at least one new issue, which is the organisation's default `Codacy Gate Policy`. Complexity, duplication, and coverage are reported but do not gate until a coverage upload exists.

The ESLint 9 tool in Codacy reads the repository's `eslint.config.*` files, so Codacy and `pnpm lint` enforce the same rules; the `lint` check stays required and Codacy never replaces it. The other tools run with Codacy's defaults tuned to this stack: a pattern is disabled only when it is wrong for the whole stack, such as one that reports on every file of a language the repository does not use; a rule that only matters in test fixtures is excluded from test files through `.codacy.yml`; a false positive on a single line is ignored with a reason (`codacy issue <id> --ignore`) and the pattern stays on. The live configuration is recorded in `docs/architecture.md`, "CI/CD", with the command that reproduces each setting made outside the repository.

Findings are read from the terminal with the Codacy Cloud CLI (`codacy pull-request <n>`) and by Claude Code through the `codacy-skills` plugin. The pull request summary and the AI review that Codacy posts as comments are advisory: a reviewer weighs them like any other comment, and only the status check gates.

## Alternatives considered

- **SonarQube Cloud**: the same class of tool, but its GitHub Actions setup needs a token in `CI`, so analysis is skipped or broken for pull requests from forks, and the attempt in #55 showed how easily it lands without a decision. Its automatic analysis mode removes the token but drops the pull request decoration that made it worth having.
- **CodeQL alone**: already on, free, and good at what it does, but it covers security only. No complexity, duplication, style, secrets, or dependency findings, and results are only in the Security tab.
- **More ESLint plugins in `CI`**: keeps every rule in the repository, which is a real advantage, but ESLint has no view of duplication, complexity trends, secrets, Compose files, or Dockerfiles, and the result is a log line rather than a per-file picture that persists over time.
- **Codacy Analysis CLI in GitHub Actions**: runs the same tools inside `CI`, so the configuration would live fully in the repository, but it needs a project token, adds minutes to every run, and produces the same findings the cloud already computes from the webhook.

## Consequences

- Positive: one check with no secret, so fork pull requests are covered; the findings of ten tools in one place, per pull request and over time; ESLint results identical to `pnpm lint`; a reviewer or Claude Code reads the findings from the terminal before asking for review.
- Negative: part of the configuration lives in Codacy rather than in git, so `docs/architecture.md` has to record it and the CLI has to reproduce it; a zero-tolerance gate stops a pull request on a minor finding, which is the point but needs the noise kept down; markdownlint now grades the documentation; the AI review comment can be wrong and must not be treated as a check.
- Follow-ups: #47 adds `Codacy Static Code Analysis` to the required checks; a separate issue uploads Vitest coverage so the diff-coverage gate can be turned on; the findings that existed before this decision are triaged in their own issue.
