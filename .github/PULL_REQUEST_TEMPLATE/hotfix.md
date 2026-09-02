<!--
Hotfix template: `hotfix/*` → `main`.
Write the description in English. Tag the people working on it; do not mention tooling. A release document is mandatory (patch version).
-->

## Working on this

<!-- @handles of everyone working on this change. -->

- @

## Issue

Closes #

## Hotfix

- **Version:** vX.Y.Z (patch bump)
- **Release document:** `docs/releases/vX.Y.Z.md`
- **Affected production version:** vX.Y.Z

## Incident

<!-- What is broken in production, since when, and who is affected. -->

## Root cause

<!-- Why it happened. -->

## Fix

<!-- What this PR changes and why it is the smallest safe change. -->

## How it was tested

- [ ] Automated test reproducing the bug added
- [ ] Verified against a production-like environment
- [ ] Manual check (describe or attach evidence)

## Rollback plan

<!-- How production is restored if the hotfix makes things worse. -->

## Checklist

- [ ] Branched from `main` and targets `main`
- [ ] Branch follows `hotfix/<issue>-<slug>`
- [ ] `docs/releases/vX.Y.Z.md` added and listed in `docs/releases/README.md`
- [ ] CI green on this PR
- [ ] After merge: tag `main`, publish the GitHub Release, and open the back-merge PR `main → develop`
