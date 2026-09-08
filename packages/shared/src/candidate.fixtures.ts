import type { Account } from "./account.js";
import type { BasicProfile } from "./basic-profile.js";
import type { Experience } from "./experience.js";
import type { Certification, Education, Language, Skill } from "./profile-parts.js";
import type { Profile, ReviewFlag } from "./profile.js";
import type { Project } from "./project.js";
import type { RebuiltResume, UploadedResume } from "./resume.js";

export function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

export const ACCOUNT_ID = "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91";
export const INGESTION_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
export const UPLOADED_RESUME_ID = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";
export const JOB_DESCRIPTION_ID = "9b2c1f34-5d6e-4a7b-8c9d-0e1f2a3b4c5d";

export const account: Account = {
  id: ACCOUNT_ID,
  email: "ada@example.com",
  name: null,
  lastName: null,
  phone: null,
  address: null,
  createdAt: "2026-09-02T10:00:00.000Z",
};

export const basicProfile: BasicProfile = {
  headline: "Backend engineer",
  summary: "Ten years building distributed systems.",
  linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
  githubUrl: "https://github.com/ada-example",
};

export const experience: Experience = {
  id: "1e4b2a6c-9d3f-4e8a-b7c5-2f6a8d1c3e5b",
  company: "Analytical Engines Ltd",
  role: "Senior Software Engineer",
  period: { start: "2021-03", end: null },
  description: "Leads the ingestion platform.",
  skills: ["TypeScript", "PostgreSQL"],
};

export const education: Education = {
  id: "2f5c3b7d-0e4a-4f9b-8c6d-3a7b9e2d4f6c",
  institution: "University of Cambridge",
  degree: "MSc",
  fieldOfStudy: "Computer Science",
  period: { start: "2014-01", end: "2016-12" },
};

export const project: Project = {
  id: "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
  name: "Difference Engine",
  description: "A mechanical calculator for polynomial functions.",
  url: "https://github.com/ada/difference-engine",
  skills: ["TypeScript"],
};

export const skill: Skill = { id: "6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e", name: "TypeScript", category: "Languages & runtimes" };

export const language: Language = { id: "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f", name: "English", level: "Native" };

export const certification: Certification = {
  id: "8d9e0f1a-2b3c-4d4e-9f5a-6b7c8d9e0f1a",
  name: "AWS Solutions Architect Associate",
  issuer: "Amazon Web Services",
  year: 2023,
};

export const reviewFlag: ReviewFlag = { part: "experience", entry: "Senior Software Engineer", field: "period", reason: "low_confidence" };

export const profile: Profile = {
  accountId: ACCOUNT_ID,
  basicProfile,
  experiences: [experience],
  education: [education],
  projects: [project],
  skills: [skill],
  languages: [language],
  certifications: [certification],
  yearsOfExperience: 5,
  reviewFlags: [reviewFlag],
  source: {
    kind: "upload",
    uploadedResumeId: UPLOADED_RESUME_ID,
    fileName: "ada-lovelace.pdf",
    ingestionId: INGESTION_ID,
    completedAt: "2026-09-02T10:05:00.000Z",
  },
  confirmedAt: null,
};

export const uploadedResume: UploadedResume = {
  id: UPLOADED_RESUME_ID,
  accountId: ACCOUNT_ID,
  createdAt: "2026-09-02T10:01:00.000Z",
  source: "upload",
  fileName: "ada-lovelace.pdf",
  contentType: "application/pdf",
  sizeBytes: 184_320,
  sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  status: "pending",
  errorCode: null,
  finishedAt: null,
  progress: null,
};

export const rebuiltResume: RebuiltResume = {
  id: "d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a",
  accountId: ACCOUNT_ID,
  createdAt: "2026-09-02T11:00:00.000Z",
  source: "rebuild",
  jobDescriptionId: JOB_DESCRIPTION_ID,
  content: "# Ada Lovelace\n\nSenior Software Engineer...",
};
