import type { Person } from "../people.ts";
import { contactLine, escape, linksLine, page, period, wordsFor } from "./html.ts";

// The look of a moderncv document: serif type, small-caps headings, dates on the left.
export function latexLike(person: Person): string {
  const words = wordsFor(person);

  return page(
    person.name,
    `
    body { font-family: "Times New Roman", Times, serif; font-size: 11pt; }
    h1 { font-size: 24pt; font-weight: normal; text-align: center; }
    .headline, .contact { text-align: center; }
    .contact { font-size: 9.5pt; color: #333; }
    h2 { font-variant: small-caps; text-transform: none; letter-spacing: 0; font-size: 13pt; border-bottom: 1px solid #333; }
    .row { display: grid; grid-template-columns: 46mm 1fr; column-gap: 6mm; margin-bottom: 6pt; }
    .row .when { color: #444; font-size: 10pt; }
    ul { margin-top: 2pt; }
    `,
    `
    <h1>${escape(person.name)}</h1>
    <div class="headline">${escape(person.headline)}</div>
    <div class="contact">${contactLine(person, " — ")}</div>
    <div class="contact">${linksLine(person)}</div>

    <h2>${words.summary}</h2>
    <p>${escape(person.summary)}</p>

    <h2>${words.experience}</h2>
    ${person.experiences
      .map(
        (experience) => `<div class="row"><div class="when">${experience.period ? period(experience.period, words) : ""}</div><div>${experience.companyFirst ? `${escape(experience.company)}, <strong>${escape(experience.role)}</strong>` : `<strong>${escape(experience.role)}</strong>, ${escape(experience.company)}`}, ${escape(experience.location)}<ul>${experience.bullets.map((bullet) => `<li>${escape(bullet)}</li>`).join("")}</ul></div></div>`,
      )
      .join("")}

    <h2>${words.education}</h2>
    ${person.education.map((education) => `<div class="row"><div class="when">${period(education.period, words)}</div><div><strong>${escape(education.degree)}</strong>, ${escape(education.institution)}</div></div>`).join("")}

    <h2>${words.skills}</h2>
    <p>${person.skills.map(escape).join(" · ")}</p>

    <h2>${words.languages}</h2>
    <p>${person.languages.map(escape).join("; ")}</p>

    ${person.certifications.length > 0 ? `<h2>${words.certifications}</h2>${person.certifications.map((certification) => `<div class="row"><div class="when">${certification.year}</div><div>${escape(certification.name)}, ${escape(certification.issuer)}</div></div>`).join("")}` : ""}
    `,
  );
}
