import type {
  BasicProfile,
  Certification,
  Education,
  Experience,
  Language,
  Period,
  Project,
  Skill,
} from "@helpmegethired/shared";

import type {
  BasicProfileRow,
  CertificationRow,
  EducationRow,
  ExperienceRow,
  LanguageRow,
  ProjectRow,
  SkillRow,
} from "../database/database.schema";

const periodOf = (row: { period_start: string | null; period_end: string | null }): Period | null =>
  row.period_start === null ? null : { start: row.period_start, end: row.period_end };

const skillsOf = (skills: unknown): string[] => (Array.isArray(skills) ? skills.filter((skill): skill is string => typeof skill === "string") : []);

export const toBasicProfile = (row: BasicProfileRow): BasicProfile => ({
  headline: row.headline,
  summary: row.summary,
  linkedinUrl: row.linkedin_url,
  githubUrl: row.github_url,
});

export const toExperience = (row: ExperienceRow): Experience => ({
  id: row.id,
  company: row.company,
  role: row.role,
  period: periodOf(row),
  description: row.description,
  skills: skillsOf(row.skills),
});

export const toEducation = (row: EducationRow): Education => ({
  id: row.id,
  institution: row.institution,
  degree: row.degree,
  fieldOfStudy: row.field_of_study,
  period: periodOf(row),
});

export const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  url: row.url,
  skills: skillsOf(row.skills),
});

export const toSkill = (row: SkillRow): Skill => ({ id: row.id, name: row.name, category: row.category });

export const toLanguage = (row: LanguageRow): Language => ({ id: row.id, name: row.name, level: row.level });

export const toCertification = (row: CertificationRow): Certification => ({
  id: row.id,
  name: row.name,
  issuer: row.issuer,
  year: row.year,
});
