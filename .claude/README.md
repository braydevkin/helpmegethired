# Claude Code configuration

- `settings.json` is the shared, committed configuration: safe read-only commands are pre-approved, force pushes are denied, and `.env` files are never readable by Claude.
- `settings.local.json` is for personal overrides and is git-ignored.
- Project instructions live in the root `CLAUDE.md`.

Add project-specific skills under `.claude/skills/<name>/SKILL.md` when a repeatable workflow emerges (for example, "create a refined issue" or "write an ADR").
