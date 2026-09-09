# Synthetic resume corpus

The resumes the parser (`apps/api/src/parser`) is measured against: fictional people and companies rendered through HTML templates to PDF, in the layouts a Candidate is likely to upload, in Portuguese and English. No file here holds a real person's data, and none ever will: every name, employer, address, e-mail, and phone number is invented, and the e-mails end in `example.com`.

Each case is one entry in `people.ts` and produces three committed files:

| File | Produced by | Holds |
| --- | --- | --- |
| `<slug>.pdf` | `pnpm --filter api corpus:generate` (Playwright's Chromium prints the template) | The resume as the Candidate would upload it |
| `<slug>.txt` | `pnpm --filter api corpus:extract` (`pdftotext -layout`, the worker's extractor) | The text the worker stores, which is what the parser reads |
| `expected/<slug>.json` | `pnpm --filter api exec vitest run src/parser/corpus.test.ts -u` | The parser's output for that text: contact, sections, and the Profile draft |

`manifest.json` records the `pdftotext` version that produced the text files.

## Layouts

`single-column`, `two-columns` (a sidebar beside the main column), `canva-like` (a coloured band and two columns), `latex-like` (a moderncv look with the dates on the left), and `linkedin-export` (the PDF LinkedIn produces from a profile). The templates live under `templates/`, one file per layout, and share the section labels in `templates/labels.ts` per language.

The single-column and LaTeX-like templates also take `variants` on a person: `educationFirst` puts the education before the experience, `noSkillsSection` leaves the skills out so they only appear inside the experience bullets, `languagesInline` writes the languages on one labelled line under the summary instead of a section, and `certificationsInExperience` writes the certifications on one labelled line closing the experience. Every variant appears at least twice across languages and layouts.

Two-column layouts come out of `pdftotext -layout` with both columns on the same lines, so their sections split poorly until the regrouping by coordinates noted in the architecture lands; the expected JSON records the current outcome so a change is noticed.

## Adding a case

1. Add a person to `people.ts` with a new `slug`, its `language`, and its `layout`. Invent everything.
2. Run `pnpm --filter api corpus:generate`. It needs Chromium: `pnpm --filter api exec playwright install chromium` once.
3. Run `pnpm --filter api corpus:extract` where `pdftotext` is installed. Without poppler on the host, run it in the worker image: `docker compose run --rm --no-deps --user node -v "$PWD/apps/api/test/fixtures/resumes/corpus:/corpus" --entrypoint node worker /corpus/extract.ts`.
4. Run the snapshot suite with `-u`, read the new `expected/<slug>.json`, and fix the rules or the data until it says what the resume says.
5. Commit the three files together with the change to `people.ts`.

A rule change that alters an existing expected file is updated the same way, deliberately, in the same pull request.
