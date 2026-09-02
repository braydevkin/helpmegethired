# Workflow

How work moves from idea to shipped code. This applies to every contributor, including Claude Code.

## Where work is defined

All work is defined in the **GitHub Project** attached to this repository. Only collaborators can edit the project board. Anyone can open an issue or start a discussion to propose work; a collaborator triages it into the project.

**No task, no code.** A change without a refined issue is not started.

## Task lifecycle

```
Idea ──▶ Issue ──▶ Refined ──▶ Ready ──▶ In Progress ──▶ In Review ──▶ Done
```

| Stage | Meaning | Who moves it |
| --- | --- | --- |
| Idea | Something worth considering. Might be a discussion or a rough issue. | Anyone opens; collaborator triages |
| Issue | Accepted into the project with a type label. | Collaborator |
| Refined | Has a clear description, acceptance criteria, scope, and dependencies. Small enough for one PR. | Collaborator, with discussion |
| Ready | Refined and unblocked. Available to pick up. | Collaborator |
| In Progress | Someone is assigned and a branch exists. | Assignee |
| In Review | PR open, CI green, review requested. | Assignee |
| Done | PR merged, docs updated, issue closed. | Reviewer |

## Refinement checklist

An issue is refined when all of these are true:

- [ ] Title describes the outcome, not the activity.
- [ ] Description explains **why** and links to the relevant part of `docs/`.
- [ ] Acceptance criteria are listed and testable.
- [ ] Scope is explicit: what is in, what is out.
- [ ] Dependencies on other issues are linked.
- [ ] It fits in a single PR that can be reviewed in one sitting.
- [ ] Labels: type (`feat`, `fix`, `docs`, `chore`, `ci`, `test`) and area (`web`, `api`, `shared`, `infra`, `ai`).

## Suggested first milestones

Ordered so that each one is usable on its own. Create these as issues in the project when ready.

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

## Branching and commits

- Branch from `main`: `<type>/<issue-number>-<short-slug>`, for example `feat/12-profile-ingestion-queue`.
- Conventional Commits, referencing the issue: `feat(api): add segment queue for profile ingestion (#12)`.
- Rebase on `main` before opening the PR. No merge commits from `main` into feature branches.
- `main` is protected: PR required, CI required, at least one review.

## Pull requests

- One issue per PR. Link it with `Closes #<n>`.
- Fill in the PR template. It asks what changed, why, how it was tested, and which docs were updated.
- CI must be green: lint, typecheck, unit, integration, e2e.
- Reviewer checks the acceptance criteria from the issue, not just the diff.

## Definition of done

- Acceptance criteria met and demonstrated (tests, screenshots, or recording).
- Tests added at the appropriate level.
- Docs updated: `docs/`, ADR if a decision was made, README map if a document was added.
- No new dependency or tooling without an ADR.
- Issue closed by the merged PR.

## Working with Claude Code

Claude Code follows `CLAUDE.md`. In practice:

- Point it at the issue number. It reads the issue, restates the acceptance criteria, then works.
- It does not commit or push unless asked.
- If it proposes something outside the stack, it must propose an ADR first.
