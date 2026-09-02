<!--
Release template: `develop` → `main`.
Write the description in English. A release document is mandatory.
-->

## Release

- **Version:** vX.Y.Z
- **Release document:** `docs/releases/vX.Y.Z.md`
- **Previous version:** vX.Y.Z

## Summary

<!-- One paragraph, in English, that a user of the platform would understand. -->

## Included changes

<!-- Every PR merged into develop since the previous release. Group by type. -->

### Features

- #

### Fixes

- #

### Other (docs, chore, ci, refactor)

- #

## Breaking changes

<!-- "None" or a list. Each breaking change needs a migration step in the release document. -->

## Verification in the test environment

- [ ] Full candidate journey executed end to end
- [ ] Playwright e2e suite green against the test environment
- [ ] Database migrations applied and reversible
- [ ] No open `bug` issues labelled for this release

## Rollback plan

<!-- How production is restored if this release fails. Reference the previous tag. -->

## Checklist

- [ ] `docs/releases/vX.Y.Z.md` added and listed in `docs/releases/README.md`
- [ ] Version follows semantic versioning rules in `docs/workflow.md`
- [ ] All included PRs are linked above
- [ ] CI green on this PR
- [ ] After merge: tag `main` with `vX.Y.Z` and publish the GitHub Release
