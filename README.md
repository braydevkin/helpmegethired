# Help Me Get Hired

> A community-driven platform for keeping the knowledge of selection processes alive, in the age of AI.

## Why this project exists

Selection processes are hard, and the knowledge needed to succeed in them is fragile. Every year that knowledge gets harder to keep alive in one's own mind: AI tools can produce a resume, a cover letter, or an interview answer in seconds, and the reasoning behind a good answer quietly disappears.

**Help Me Get Hired** is built to reverse that. The goal of the project is to build a community that expands its knowledge of selection processes, even in the age of AI, when keeping that knowledge alive in one's mind has become difficult. It is a platform for knowledge and logical thinking that helps not only candidates but also companies keep the spirit of intelligent engineering alive.

AI is a tool here, not a replacement for thinking. Every AI-assisted step in the product is designed to teach the candidate *why* the result looks the way it does.

## What the platform does

A candidate walks through a single, sequential journey:

1. **Sign up** and build a profile from an uploaded resume PDF and a LinkedIn profile URL.
2. **AI profile analysis** produces a profile page with strengths and weaknesses.
3. **Paste a job description**, which is analysed against the profile.
4. **ATS scoring** rates the resume from 0 to 10 for that specific job description.
5. **Resume recommendations** rebuild the resume when the ATS score is below 8, based on the candidate's experiences, projects, and profile.
6. **Study recommendations** derive what to learn from previous applications and turn it into a structured study plan.
7. **Apply helper** assembles a cover letter, the updated resume, and the study plan for that application.
8. **AI mock interview** for the target role.
9. **Preparation summary** with success rates across every step.

The full product definition lives in [docs/product/vision.md](docs/product/vision.md) and [docs/product/requirements.md](docs/product/requirements.md). The original idea diagram is in [arch/helpmegethired-architecture.drawio](arch/helpmegethired-architecture.drawio).

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js |
| Backend | NestJS |
| AI orchestration | LangChain |
| Database / RAG | PostgreSQL + pgvector |
| Monorepo | Turborepo + pnpm workspaces |
| Unit / integration tests | Vitest |
| End-to-end tests | Playwright |
| Local runtime | Docker (whole monorepo) |
| CI/CD | GitHub Actions |
| Task management | GitHub Projects |

Each of these choices is recorded with its reasoning in [docs/adr](docs/adr/README.md).

## Project status

**Foundation.** Branching follows Gitflow: `main` is production, `develop` is the test environment. The repository holds the product idea, the architecture, the way of working, the Claude Code configuration, the monorepo scaffold (Turborepo, pnpm workspaces, shared TypeScript and ESLint configurations), the shared schemas package, the NestJS API scaffold with configuration validation and a health endpoint, and the Next.js web scaffold with a placeholder home page, Vitest component tests, and a Playwright smoke test in `e2e/`. Applications and shared packages grow task by task from the GitHub Project. See [docs/workflow.md](docs/workflow.md).

## Documentation map

| Document | What it answers |
| --- | --- |
| [docs/product/vision.md](docs/product/vision.md) | Why the project exists, who it serves, what success looks like |
| [docs/product/requirements.md](docs/product/requirements.md) | Functional requirements, application flow, technical constraints |
| [docs/architecture.md](docs/architecture.md) | System architecture, monorepo layout, AI pipeline, data model |
| [docs/workflow.md](docs/workflow.md) | Gitflow branching, how tasks are created, refined, built, reviewed, and released |
| [docs/releases/](docs/releases/README.md) | Release notes, one document per production release |
| [docs/adr/](docs/adr/README.md) | Architecture Decision Records |
| [CONTEXT.md](CONTEXT.md) | Glossary: the canonical words for the concepts in this project |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [CLAUDE.md](CLAUDE.md) | Instructions for Claude Code when working in this repository |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Tasks are defined in the GitHub Project, which only collaborators can edit. Anyone can open an issue or a discussion to propose work.

## License

Not yet chosen. See the open decision in [docs/adr/README.md](docs/adr/README.md).
