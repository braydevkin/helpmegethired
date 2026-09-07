import type { Person } from "../people.ts";
import { escape, page, period, wordsFor } from "./html.ts";

// The PDF LinkedIn produces from a profile: a narrow contact column, then the name, the
// headline, the location, and the sections in LinkedIn's order.
export function linkedinExport(person: Person): string {
  const words = wordsFor(person);

  return page(
    person.name,
    `
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; }
    .columns { display: grid; grid-template-columns: 48mm 1fr; column-gap: 12mm; }
    .side { font-size: 9pt; color: #444; }
    .side h3 { font-size: 10pt; margin: 0 0 4pt; color: #222; }
    .side p { margin: 0 0 3pt; }
    .side .block { margin-bottom: 14pt; }
    h1 { font-size: 20pt; }
    .headline { font-size: 11.5pt; margin-top: 2pt; }
    .location { color: #555; font-size: 9.5pt; margin-bottom: 8pt; }
    h2 { border: none; text-transform: none; letter-spacing: 0; font-size: 13pt; margin-top: 12pt; }
    .entry { margin-bottom: 8pt; }
    .entry-meta { color: #555; font-size: 9pt; }
    `,
    `
    <div class="columns">
      <aside class="side">
        <div class="block">
          <h3>${words.contact}</h3>
          <p>${escape(person.phone)}</p>
          <p>${escape(person.email)}</p>
          <p>${escape(person.linkedin)}</p>
        </div>
        <div class="block">
          <h3>${words.topSkills}</h3>
          ${person.skills.slice(0, 3).map((skill) => `<p>${escape(skill)}</p>`).join("")}
        </div>
        <div class="block">
          <h3>${words.languages}</h3>
          ${person.languages.map((language) => `<p>${escape(language.replace(" - ", " (")).replace(/$/u, ")")}</p>`).join("")}
        </div>
        ${person.certifications.length > 0 ? `<div class="block"><h3>${words.certifications}</h3>${person.certifications.map((certification) => `<p>${escape(certification.name)}</p>`).join("")}</div>` : ""}
      </aside>
      <main>
        <h1>${escape(person.name)}</h1>
        <div class="headline">${escape(person.headline)}</div>
        <div class="location">${escape(person.location)}</div>
        <h2>${words.summary}</h2>
        <p>${escape(person.summary)}</p>
        <h2>${words.experience}</h2>
        ${person.experiences
          .map(
            (experience) => `<div class="entry"><strong>${escape(experience.company)}</strong><br>${escape(experience.role)}<div class="entry-meta">${period(experience.period, words)}</div><div class="entry-meta">${escape(experience.location)}</div><p>${experience.bullets.map(escape).join(" ")}</p></div>`,
          )
          .join("")}
        <h2>${words.education}</h2>
        ${person.education.map((education) => `<div class="entry"><strong>${escape(education.institution)}</strong><br>${escape(education.degree)} · (${period(education.period, words)})</div>`).join("")}
      </main>
    </div>
    `,
  );
}
