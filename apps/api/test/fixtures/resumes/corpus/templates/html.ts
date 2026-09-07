import type { EducationData, ExperienceData, Period, Person } from "../people.ts";
import { labels, type Labels } from "./labels.ts";

export const escape = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export const period = (value: Period, words: Labels): string => `${value.start} – ${value.end ?? words.present}`;

export const list = (items: readonly string[]): string => `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;

const heading = (experience: ExperienceData, separator: string): string =>
  experience.companyFirst
    ? `${escape(experience.company)}${separator}<strong>${escape(experience.role)}</strong>`
    : `<strong>${escape(experience.role)}</strong>${separator}${escape(experience.company)}`;

export const experienceBlock = (experience: ExperienceData, words: Labels, separator = " | "): string => `
  <div class="entry">
    <div class="entry-head">${heading(experience, separator)}</div>
    <div class="entry-meta">${escape(experience.location)}${experience.period ? ` · ${period(experience.period, words)}` : ""}</div>
    ${list(experience.bullets)}
  </div>`;

export const educationBlock = (education: EducationData, words: Labels): string => `
  <div class="entry">
    <div class="entry-head"><strong>${escape(education.degree)}</strong>, ${escape(education.institution)}</div>
    <div class="entry-meta">${period(education.period, words)}</div>
  </div>`;

export const wordsFor = (person: Person): Labels => labels[person.language];

export const contactLine = (person: Person, separator = " | "): string =>
  [person.location, person.phone, person.email].map(escape).join(separator);

export const linksLine = (person: Person, separator = " · "): string =>
  [person.linkedin, person.github, person.website].filter((link): link is string => link !== null).map(escape).join(separator);

export const page = (title: string, style: string, body: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escape(title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; margin: 0; }
  h1 { font-size: 22pt; margin: 0; }
  h2 { font-size: 11.5pt; text-transform: uppercase; letter-spacing: 0.06em; margin: 14pt 0 6pt; border-bottom: 1px solid #999; padding-bottom: 2pt; }
  ul { margin: 4pt 0 0; padding-left: 14pt; }
  li { margin: 2pt 0; }
  .entry { margin-bottom: 8pt; }
  .entry-meta { color: #555; font-size: 9.5pt; }
  ${style}
</style>
</head>
<body>${body}</body>
</html>`;
