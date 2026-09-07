import type { Person } from "../people.ts";
import { contactLine, educationBlock, escape, experienceBlock, linksLine, list, page, wordsFor } from "./html.ts";

export function singleColumn(person: Person): string {
  const words = wordsFor(person);

  return page(
    person.name,
    ".headline { font-size: 13pt; color: #333; margin: 2pt 0 6pt; } .contact { color: #444; font-size: 9.5pt; }",
    `
    <h1>${escape(person.name)}</h1>
    <div class="headline">${escape(person.headline)}</div>
    <div class="contact">${contactLine(person)}</div>
    <div class="contact">${linksLine(person)}</div>

    <h2>${words.summary}</h2>
    <p>${escape(person.summary)}</p>

    <h2>${words.experience}</h2>
    ${person.experiences.map((experience) => experienceBlock(experience, words)).join("")}

    <h2>${words.education}</h2>
    ${person.education.map((education) => educationBlock(education, words)).join("")}

    <h2>${words.skills}</h2>
    <p>${person.skills.map(escape).join(", ")}</p>

    ${person.projects.length > 0 ? `<h2>${words.projects}</h2>${person.projects.map((project) => `<div class="entry"><strong>${escape(project.name)}</strong>${project.url ? ` — ${escape(project.url)}` : ""}<br>${escape(project.description)}</div>`).join("")}` : ""}

    <h2>${words.languages}</h2>
    ${list(person.languages)}

    ${person.certifications.length > 0 ? `<h2>${words.certifications}</h2>${list(person.certifications.map((certification) => `${certification.name} — ${certification.issuer}, ${certification.year}`))}` : ""}
    `,
  );
}
