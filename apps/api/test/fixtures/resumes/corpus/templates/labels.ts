import type { Language } from "../people.ts";

export interface Labels {
  contact: string;
  summary: string;
  experience: string;
  education: string;
  skills: string;
  projects: string;
  languages: string;
  certifications: string;
  present: string;
  topSkills: string;
  page: (number: number, total: number) => string;
}

export const labels: Record<Language, Labels> = {
  en: {
    contact: "Contact",
    summary: "Summary",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    projects: "Projects",
    languages: "Languages",
    certifications: "Certifications",
    present: "Present",
    topSkills: "Top Skills",
    page: (number, total) => `Page ${number} of ${total}`,
  },
  pt: {
    contact: "Contato",
    summary: "Resumo",
    experience: "Experiência Profissional",
    education: "Formação Acadêmica",
    skills: "Habilidades",
    projects: "Projetos",
    languages: "Idiomas",
    certifications: "Certificações",
    present: "Atual",
    topSkills: "Principais competências",
    page: (number, total) => `Página ${number} de ${total}`,
  },
};
