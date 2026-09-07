import type { Person } from "../people.ts";
import { educationBlock, escape, experienceBlock, list, page, wordsFor } from "./html.ts";

// A coloured band with the name and the headline, the contact details in one row, and the
// body in two columns with the wider one on the left.
export function canvaLike(person: Person): string {
  const words = wordsFor(person);

  return page(
    person.name,
    `
    body { font-family: Georgia, "Times New Roman", serif; }
    .band { background: #1f6f8b; color: white; padding: 14pt 16pt; margin: 0 0 8pt; }
    .band h1 { color: white; font-family: Helvetica, Arial, sans-serif; }
    .band .headline { font-size: 12pt; opacity: 0.9; margin-top: 4pt; }
    .row { display: flex; gap: 14pt; font-size: 9.5pt; color: #333; margin-bottom: 8pt; flex-wrap: wrap; }
    .columns { display: grid; grid-template-columns: 1fr 55mm; column-gap: 8mm; }
    h2 { color: #1f6f8b; border-bottom-color: #1f6f8b; }
    `,
    `
    <div class="band">
      <h1>${escape(person.name)}</h1>
      <div class="headline">${escape(person.headline)}</div>
    </div>
    <div class="row">
      <span>${escape(person.location)}</span><span>${escape(person.phone)}</span><span>${escape(person.email)}</span>
      <span>${escape(person.linkedin)}</span>${person.website ? `<span>${escape(person.website)}</span>` : ""}
    </div>
    <div class="columns">
      <main>
        <h2>${words.summary}</h2>
        <p>${escape(person.summary)}</p>
        <h2>${words.experience}</h2>
        ${person.experiences.map((experience) => experienceBlock(experience, words, ", ")).join("")}
        ${person.projects.length > 0 ? `<h2>${words.projects}</h2>${person.projects.map((project) => `<div class="entry"><strong>${escape(project.name)}</strong> · ${escape(project.description)}${project.url ? ` (${escape(project.url)})` : ""}</div>`).join("")}` : ""}
      </main>
      <aside>
        <h2>${words.education}</h2>
        ${person.education.map((education) => educationBlock(education, words)).join("")}
        <h2>${words.skills}</h2>
        ${list(person.skills)}
        <h2>${words.languages}</h2>
        ${list(person.languages)}
      </aside>
    </div>
    `,
  );
}
