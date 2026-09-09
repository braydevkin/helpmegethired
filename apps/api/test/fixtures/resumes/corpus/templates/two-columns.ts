import type { Person } from "../people.ts";
import { educationBlock, escape, experienceBlock, list, page, wordsFor } from "./html.ts";

// A narrow sidebar with the contact details, skills, and languages beside the main column.
export function twoColumns(person: Person): string {
  const words = wordsFor(person);

  return page(
    person.name,
    `
    .top { border-bottom: 2px solid #2a4d69; padding-bottom: 8pt; margin-bottom: 10pt; }
    .headline { font-size: 13pt; color: #2a4d69; }
    .columns { display: grid; grid-template-columns: 58mm 1fr; column-gap: 10mm; }
    .side h2 { border: none; color: #2a4d69; }
    .side p, .side li { font-size: 9.5pt; }
    .side ul { list-style: none; padding: 0; }
    `,
    `
    <div class="top">
      <h1>${escape(person.name)}</h1>
      <div class="headline">${escape(person.headline)}</div>
    </div>
    <div class="columns">
      <aside class="side">
        <h2>${words.contact}</h2>
        <p>${escape(person.location)}</p>
        <p>${escape(person.phone)}</p>
        <p>${escape(person.email)}</p>
        <p>${escape(person.linkedin)}</p>
        ${person.github ? `<p>${escape(person.github)}</p>` : ""}
        ${person.website ? `<p>${escape(person.website)}</p>` : ""}
        <h2>${words.skills}</h2>
        ${list(person.skills)}
        <h2>${words.languages}</h2>
        ${list(person.languages)}
        ${person.certifications.length > 0 ? `<h2>${words.certifications}</h2>${list(person.certifications.map((certification) => `${certification.name} (${certification.issuer}, ${certification.year})`))}` : ""}
      </aside>
      <main>
        <h2>${words.summary}</h2>
        <p>${escape(person.summary)}</p>
        <h2>${words.experience}</h2>
        ${person.experiences.map((experience) => experienceBlock(experience, words, " — ")).join("")}
        <h2>${words.education}</h2>
        ${person.education.map((education) => educationBlock(education, words)).join("")}
        ${person.projects.length > 0 ? `<h2>${words.projects}</h2>${person.projects.map((project) => `<div class="entry"><strong>${escape(project.name)}</strong><br>${escape(project.description)}${project.url ? `<br>${escape(project.url)}` : ""}</div>`).join("")}` : ""}
      </main>
    </div>
    `,
  );
}
