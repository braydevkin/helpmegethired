import type { Field, Period, QuotedPeriod, QuotedText, SegmentRecognition, SegmentRecognitionKind } from "@helpmegethired/shared";

import {
  TECHNOLOGIES,
  certificationsOf,
  educationOf,
  experiencesOf,
  extractSkills,
  findDateRange,
  headerOf,
  languagesOf,
  projectsOf,
  splitSections,
  type Section,
} from "../parser";
import { recognitionSchemaOf } from "./recognition-schema";
import { VerbatimText } from "./verbatim-text";

interface Quoted<Value> {
  value: Value;
  quote: string;
}

function quoted<Value>(field: Field<Value> | null, quoteOf: (value: Value) => string | undefined): Quoted<Value> | null {
  const quote = field ? quoteOf(field.value) : undefined;

  return field && quote ? { value: field.value, quote } : null;
}

// The Segment's lines as the processors hand them to the model, and the text every quote is cut from.
class SegmentSource {
  readonly verbatim: VerbatimText;
  readonly sections: Section[];

  constructor(readonly lines: readonly string[]) {
    this.verbatim = new VerbatimText(lines.join("\n"));
    this.sections = splitSections(lines);
  }

  text(field: Field<string> | null): QuotedText | null {
    return quoted(field, (value) => this.verbatim.quoteOf(value));
  }

  url(field: Field<string> | null): QuotedText | null {
    return quoted(field, (value) => this.verbatim.urlQuoteOf(value));
  }

  year(field: Field<number> | null): Quoted<number> | null {
    return quoted(field, (value) => this.verbatim.quoteOf(String(value)));
  }

  // Each line holds at most one date range the rules read, so the first line whose range gives
  // the same period is where it was read.
  period(field: Field<Period> | null): QuotedPeriod | null {
    if (!field) {
      return null;
    }

    for (const line of this.lines) {
      const range = findDateRange(line);

      if (range && range.period.start === field.value.start && range.period.end === field.value.end) {
        return { ...field.value, quote: line.slice(range.index, range.index + range.length) };
      }
    }

    return null;
  }

  // The rules name a technology by its canonical name, which the text may spell another way, so
  // the quote is the longest spelling the dictionary knows that the text holds.
  technology(name: string): QuotedText | null {
    const technology = TECHNOLOGIES.find((known) => known.name === name);
    const spellings = [
      ...(technology?.exact ?? []).map((spelling) => ({ spelling, matchCase: true })),
      ...(technology?.synonyms ?? []).map((spelling) => ({ spelling, matchCase: false })),
    ].sort((one, other) => other.spelling.length - one.spelling.length);

    for (const { spelling, matchCase } of spellings) {
      const span = this.verbatim.spanOf(spelling, { matchCase });

      if (span) {
        return { value: name, quote: this.verbatim.sliceOf(span) };
      }
    }

    return null;
  }

  technologies(names: readonly string[]): QuotedText[] {
    return names.flatMap((name) => this.technology(name) ?? []);
  }
}

type RecognitionByRules = { [Kind in SegmentRecognitionKind]: (source: SegmentSource) => SegmentRecognition<Kind> };

const present = <Value>(value: Value | null): Value[] => (value === null ? [] : [value]);

const RECOGNITION_BY_RULES: RecognitionByRules = {
  header: (source) => {
    const { basicProfile } = headerOf(source.lines);

    return {
      headline: source.text(basicProfile.headline),
      summary: source.text(basicProfile.summary),
      linkedinUrl: source.url(basicProfile.linkedinUrl),
      githubUrl: source.url(basicProfile.githubUrl),
    };
  },
  experience: (source) => ({
    experiences: experiencesOf(source.sections).flatMap((experience) =>
      present(source.text(experience.role)).map((role) => ({
        role,
        company: source.text(experience.company),
        period: source.period(experience.period),
        description: source.text(experience.description),
        skills: source.technologies(experience.skills),
      })),
    ),
  }),
  education: (source) => ({
    education: educationOf(source.sections).flatMap((education) =>
      present(source.text(education.institution)).map((institution) => ({
        institution,
        degree: source.text(education.degree),
        fieldOfStudy: source.text(education.fieldOfStudy),
        period: source.period(education.period),
      })),
    ),
  }),
  project: (source) => ({
    projects: projectsOf(source.sections).flatMap((project) =>
      present(source.text(project.name)).map((name) => ({
        name,
        description: source.text(project.description),
        url: source.url(project.url),
        skills: source.technologies(project.skills),
      })),
    ),
  }),
  skills: (source) => ({
    skills: extractSkills(source.sections).flatMap((skill) =>
      present(source.technology(skill.name)).map((name) => ({ name, category: skill.category })),
    ),
  }),
  languages: (source) => ({
    languages: languagesOf(source.sections).flatMap((language) =>
      present(source.text(language.name)).map((name) => ({ name, level: source.text(language.level) })),
    ),
  }),
  certifications: (source) => ({
    certifications: certificationsOf(source.sections).flatMap((certification) =>
      present(source.text(certification.name)).map((name) => ({
        name,
        issuer: source.text(certification.issuer),
        year: source.year(certification.year),
      })),
    ),
  }),
};

// What the deterministic rules read from a Segment, answered the way a model must answer: every
// value with the verbatim span it came from. A value whose span cannot be found is left out, as a
// model's unquotable value would be discarded.
export function recognitionByRules<Kind extends SegmentRecognitionKind>(kind: Kind, lines: readonly string[]): SegmentRecognition<Kind> {
  return recognitionSchemaOf(kind).parse(RECOGNITION_BY_RULES[kind](new SegmentSource(lines)));
}
