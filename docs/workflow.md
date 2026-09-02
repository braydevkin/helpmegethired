# Workflow

How work moves from idea to shipped code. This applies to every contributor, including Claude Code.

## Where work is defined

All work is defined in the **GitHub Project** attached to this repository. Only collaborators can edit the project board. Anyone can open an issue or start a discussion to propose work; a collaborator triages it into the project.

**No task, no code.** A change without a refined issue is not started.

## Task lifecycle

Status changes are automated from GitHub activity wherever possible: a new issue lands in Backlog, a linked PR moves it to In Review, a merged PR or closed issue moves it to Done. Refined and Ready are set by a collaborator. The automation is the `Board` workflow described in [architecture.md](architecture.md#cicd); it links a PR to its issues through the `Closes #<n>` line of the PR description.

```
Idea ──▶ Backlog ──▶ Refined ──▶ Ready ──▶ In Progress ──▶ In Review ──▶ Done
```

| Stage | Meaning | Who moves it |
| --- | --- | --- |
| Idea | Something worth considering. Might be a discussion or a rough issue. | Anyone opens; collaborator triages |
| Backlog | Accepted into the project with a type label. Every new issue starts here. | Automatic on issue creation |
| Refined | Has a clear description, acceptance criteria, scope, and dependencies. Small enough for one PR. | Collaborator, with discussion |
| Ready | Refined and unblocked. Available to pick up. | Collaborator |
| In Progress | Someone is assigned and a `feature/`, `fix/`, or `hotfix/` branch exists. | Assignee |
| In Review | PR open, CI green, review requested. | Assignee |
| Done | PR merged into `develop`, docs updated, issue closed. Reaches production with the next release. | Reviewer |

## Refinement checklist

An issue is refined when all of these are true:

- [ ] Title describes the outcome, not the activity.
- [ ] Description explains **why** and links to the relevant part of `docs/`.
- [ ] Acceptance criteria are listed and testable.
- [ ] Scope is explicit: what is in, what is out.
- [ ] Dependencies on other issues are linked.
- [ ] It fits in a single PR that can be reviewed in one sitting.
- [ ] Labels: exactly one type (`feature`, `fix`, `architecture`, `docs`, `chore`) and one or more areas (`frontend`, `backend`, `shared`, `infra`, `ai`).
- [ ] Milestone set to one of: Foundation, Account and Profile, Job Analysis, Learning and Apply, Interview and Summary.

## Milestones

A milestone is a slice of the candidate journey that is usable on its own once done. The five milestones exist in the repository; the numbered items below are the capabilities each one groups, in build order.

1. **Repository foundation**: Turborepo + pnpm workspace, shared configs, `packages/shared`, Docker Compose with PostgreSQL + pgvector, CI running lint/typecheck/test.
2. **Account**: sign up / sign in in `apps/api` and `apps/web`.
3. **Profile ingestion**: PDF upload, segment queue, resumable progress, profile entities.
4. **LinkedIn reading**: API integration or documented fallback.
5. **Profile analysis**: RAG over profile, strengths and weaknesses page.
6. **Job description**: paste, store, embed.
7. **ATS scoring**: first AI service, score 0–10.
8. **Resume builder**: triggered when score < 8.
9. **Learnings and study plan**.
10. **Apply helper**.
11. **Mock interview**.
12. **Preparation summary**.

## Branching model: Gitflow

Two long-lived branches, three kinds of short-lived branches.

| Branch | Role | Deploys to | Protected |
| --- | --- | --- | --- |
| `main` | Production. Only receives release and hotfix PRs. Every merge is a tagged release. | Production environment | Yes |
| `develop` | Integration. Default branch. Receives feature and fix PRs. | Test environment | Yes |
| `feature/<issue>-<slug>` | New capability. Branched from `develop`, merged back into `develop`. | Preview (optional) | No |
| `fix/<issue>-<slug>` | Bug fix found in `develop` or in the test environment. Branched from `develop`, merged into `develop`. | Preview (optional) | No |
| `hotfix/<issue>-<slug>` | Urgent fix for production. Branched from `main`, merged into `main` **and** back into `develop`. | Production after merge | No |

```
main     ──●────────────────────────●──────────●──▶   (v1.0.0)      (v1.0.1)   (v1.1.0)
            \                      / \        /
hotfix       \           hotfix/──●   \      /
              \                        \    /
develop  ──────●───●───●───●───●────────●──●──────▶
                \     /     \   /
feature/         ●───●       ●─●  fix/
```

Rules:

- `feature/*` and `fix/*` branch from `develop` and target `develop`.
- `hotfix/*` branches from `main`, targets `main`, and is merged back into `develop` immediately after (open a second PR `main → develop` or cherry-pick; never leave `develop` behind `main`).
- A **release** is a PR from `develop` to `main`. It must include a release document (see below). On merge, `main` is tagged `vX.Y.Z`.
- Nobody commits directly to `main` or `develop`. Both require a PR, a green CI, and a review.
- Keep branches short-lived. Rebase on the target branch before opening the PR; no merge commits from the target into the branch.
- Delete the branch after merge.

### Commits

Conventional Commits, referencing the issue: `feat(api): add ATS scoring service (#42)`. Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`, `ci`, `hotfix`.

### Versioning

Semantic versioning on `main` tags:

- **MAJOR**: breaking change to the API contract or the candidate journey.
- **MINOR**: new capability (a release from `develop` that adds features).
- **PATCH**: fixes only, including hotfixes.

## Pull requests

All PR descriptions are written in **English** and use the templates in `.github/`. GitHub applies the default template automatically; the release and hotfix templates are selected with a query parameter when opening the PR.

| PR | Template | How to use it |
| --- | --- | --- |
| `feature/*` or `fix/*` → `develop` | `.github/PULL_REQUEST_TEMPLATE.md` | Applied automatically. |
| `develop` → `main` (release) | `.github/PULL_REQUEST_TEMPLATE/release.md` | Append `?template=release.md` to the compare URL, or run `gh pr create --template release.md`. |
| `hotfix/*` → `main` | `.github/PULL_REQUEST_TEMPLATE/hotfix.md` | Append `?template=hotfix.md` to the compare URL, or run `gh pr create --template hotfix.md`. |

Common rules:

- One issue per feature or fix PR. Link it with `Closes #<n>`.
- Fill in every section of the template. Empty sections are a review blocker.
- Tag the people working on the change in the "Working on this" section. PR descriptions describe the work, not the tools used to produce it.
- CI must be green: lint, typecheck, unit, integration, e2e.
- Reviewer checks the acceptance criteria from the issue, not just the diff.

## Releases

Every PR to `main` ships a release document. No release document, no merge.

1. Decide the version (`vX.Y.Z`) following the versioning rules above.
2. Copy `docs/releases/template.md` to `docs/releases/vX.Y.Z.md` on the release (or hotfix) branch and fill it in: summary, changes grouped by type with issue links, breaking changes, migration steps, rollback plan, and verification done in the test environment.
3. Add the entry to `docs/releases/README.md`.
4. Open the PR to `main` with the release or hotfix template. The PR body links to the release document.
5. After merge, tag `main` with `vX.Y.Z` and create a GitHub Release whose notes are the release document.
6. For a hotfix, merge `main` back into `develop` right away.

## Definition of done

- Acceptance criteria met and demonstrated (tests, screenshots, or recording).
- Tests added at the appropriate level.
- Docs updated: `docs/`, ADR if a decision was made, README map if a document was added.
- No new dependency or tooling without an ADR.
- Issue closed by the merged PR.

## Working with Claude Code

Claude Code follows `CLAUDE.md`. In practice:

- Point it at the issue number. It reads the issue, restates the acceptance criteria, then works.
- It branches from `develop` (or from `main` for a hotfix) and never targets `main` with a feature or fix.
- It does not commit or push unless asked.
- If it proposes something outside the stack, it must propose an ADR first.
