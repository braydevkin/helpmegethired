# ADR-0015: Atomic design for frontend components

- **Status:** Accepted
- **Date:** 2026-09-03
- **Deciders:** @braydevkin

## Context

The Account design (#29, [Design: Account](https://github.com/braydevkin/helpmegethired/wiki/Design-Account) in the wiki) is the first visual definition the frontend builds against, and it sets the visual language of the whole web app. Three tasks implement it: the foundation with tokens and reusable pieces (#32), sign in (#33), and sign up (#34). The two flows share the email and code screens, the brand panel, and every control, so the pieces are built once and composed by the pages. Today `apps/web` has one form component next to its route and no convention for where a shared component lives, how it is named, or what it may import. Without one, #33 and #34 would each decide, and the review would have nothing to hold them to.

The forces:

- **Composition over duplication**: the same field, button, code input, and layout appear on five screens with different copy and progress. The structure must make reuse the default.
- **A review the design document can drive**: the design definition names screens, controls, and a layout. The implementation should be inspectable as the same tree, so a reviewer can diff the code against the document.
- **Contributors arriving cold**: the project is built in public. The vocabulary must be one a newcomer can look up and that a non-technical reader can follow.
- **Boundaries that survive hurried changes**: the App Router blurs the line between a page and a component. Pages own data and server actions; a component that reaches into them stops being reusable and becomes untestable without the router.

## Decision

Frontend components in `apps/web` follow **atomic design** as described by Brad Frost in [Atomic Design, chapter 2](https://atomicdesign.bradfrost.com/chapter-2/): interfaces are built from five stages, each composed of the one below it.

| Stage | What it is | In this project |
| --- | --- | --- |
| Atom | The smallest functional element: a button, an input, a label. | `src/components/atoms/` |
| Molecule | A few atoms working as one unit with a single responsibility: a labelled field with its error. | `src/components/molecules/` |
| Organism | A distinct section of the interface made of molecules and atoms: a form, a header, a panel. | `src/components/organisms/` |
| Template | The page-level structure: where organisms sit, without real content. | `src/components/templates/` |
| Page | A template filled with real content and data. | `page.tsx` files under `src/app` |

The mapping onto the App Router:

- **Pages are `page.tsx` files and nothing else.** There is no `pages/` folder under `components/`, because `src/app` already is that stage. A page fetches data, calls server actions, reads the Session, and renders a template with organisms.
- **Templates are plain components.** A route group `layout.tsx` renders a template from `components/templates/`, so the template can be rendered by Vitest without the router. Frost's template is not the App Router's `template.tsx`, which is a reserved file that re-mounts on navigation; the two never share a folder.
- **Imports go down, never up.** A stage imports only from the stages below it. Only pages touch the API client, the Session, and server actions; everything under `components/` receives what it needs as props.

| Stage | May import from |
| --- | --- |
| atoms | nothing under `components/` |
| molecules | atoms |
| organisms | molecules, atoms |
| templates | organisms, molecules, atoms |
| pages | anything |

- **One folder per component**, named in kebab-case, holding the component and its test: `components/molecules/code-input/code-input.tsx` and `code-input.test.tsx`. Components are imported by the full path to their file. There are no barrel `index.ts` files: a barrel per stage hides which component an import reaches and blurs the boundary the rule above protects.
- **`"use client"` goes on the lowest stage that needs browser state.** Atoms and templates stay server-renderable; an organism such as the code form carries the directive when it owns interaction.
- **Design tokens are not components.** They stay as CSS custom properties in `globals.css`, declared once from the design document, and every stage reads them.

Atomic design is a mental model, not a process: a page and its atoms are shaped together, and a component moves between stages when its responsibility changes. The stage names are used as Frost defines them; the project does not rename them.

## Alternatives considered

- **Feature folders next to each route** (`app/(account)/sign-in/components/`): keeps a page's pieces close to it, but the Account flows share almost every piece, so the shared ones would drift into an unnamed common folder anyway, and nothing would say what a piece may depend on.
- **A flat `components/` folder**: the least ceremony, and the point where every project starts. It gives no vocabulary for size or responsibility, so "is this a field or a form" is decided by each author, and the import rule has nothing to attach to.
- **A design system package under `packages/ui`**: right when a second app needs the components, premature while `apps/web` is the only consumer. The package boundary would add a build step and a publish surface without a second reader. The stages chosen here move into such a package unchanged when the time comes.

## Consequences

- Positive: the design document and the component tree describe the same hierarchy, so a review can diff one against the other; the shared screens of sign in and sign up are one set of organisms with different props; a component below the page stage renders in Vitest without the router, the API, or the Session; a newcomer can read Frost's chapter and know where a file goes.
- Negative: five folders for a small app at first; a component's stage is sometimes a judgement call, and moving it means moving its folder and imports; the downward rule forbids the shortcut of calling a server action from inside an organism, so pages pass callbacks down.
- Follow-ups: #32 creates the folders and adds an ESLint rule in `apps/web` that enforces the import direction, following the shape of `no-cross-app-imports`; the existing `CredentialsForm` under the route group is replaced by #33 and #34 and not moved; a `packages/ui` package with the same stages gets its own ADR when a second app consumes the components.
