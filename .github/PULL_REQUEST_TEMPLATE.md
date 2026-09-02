<!--
Default template for feature/* and fix/* branches targeting `develop`.
Write the description in English. Tag the people working on it; do not mention tooling. Fill in every section.
For a release (develop → main) use ?template=release.md
For a hotfix (hotfix/* → main) use ?template=hotfix.md
-->

## Working on this

<!-- @handles of everyone working on this change. -->

- @

## Issue

Closes #

## Type

- [ ] Feature (`feature/*` → `develop`)
- [ ] Fix (`fix/*` → `develop`)

## What changed

<!-- Short description of the change, in English. -->

## Why

<!-- The outcome this produces. Link the relevant doc, requirement (FR-xx / TC-xx), or ADR. -->

## How it was tested

- [ ] Unit tests (Vitest)
- [ ] Integration tests (Vitest against Dockerised PostgreSQL)
- [ ] End-to-end tests (Playwright)
- [ ] Manual check (describe or attach screenshots)

## Documentation

- [ ] `docs/` updated where behaviour or architecture changed
- [ ] ADR added if a decision was made
- [ ] README documentation map updated if a document was added
- [ ] No new dependency or tooling outside the stack (or an ADR is linked)

## Checklist

- [ ] Branched from `develop` and targets `develop`
- [ ] Branch follows `feature/<issue>-<slug>` or `fix/<issue>-<slug>`
- [ ] Commits follow Conventional Commits and reference the issue
- [ ] Acceptance criteria from the issue are met
- [ ] Rebased on `develop`, no merge commits from `develop`
