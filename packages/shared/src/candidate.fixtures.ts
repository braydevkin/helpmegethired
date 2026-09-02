import type { Account } from "./account.js";
import type { BasicProfile } from "./basic-profile.js";
import type { Experience } from "./experience.js";
import type { Profile } from "./profile.js";
import type { Project } from "./project.js";
import type { RebuiltResume, UploadedResume } from "./resume.js";

export function without<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

export const ACCOUNT_ID = "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91";
export const PROFILE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
export const JOB_DESCRIPTION_ID = "9b2c1f34-5d6e-4a7b-8c9d-0e1f2a3b4c5d";

export const account: Account = {
  id: ACCOUNT_ID,
  email: "ada@example.com",
  createdAt: "2026-09-02T10:00:00.000Z",
};

export const basicProfile: BasicProfile = {
  fullName: "Ada Lovelace",
  headline: "Backend engineer",
  summary: "Ten years building distributed systems.",
  location: "London, UK",
  linkedinUrl: "https://www.linkedin.com/in/ada-lovelace",
};

export const experience: Experience = {
  id: "1e4b2a6c-9d3f-4e8a-b7c5-2f6a8d1c3e5b",
  company: "Analytical Engines Ltd",
  role: "Senior Software Engineer",
  startDate: "2021-03-01",
  endDate: null,
  description: "Leads the ingestion platform.",
  skills: ["TypeScript", "PostgreSQL"],
};

export const project: Project = {
  id: "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d",
  name: "Difference Engine",
  description: "A mechanical calculator for polynomial functions.",
  url: "https://github.com/ada/difference-engine",
  skills: ["Mathematics"],
};

export const profile: Profile = {
  id: PROFILE_ID,
  accountId: ACCOUNT_ID,
  basicProfile,
  experiences: [experience],
  projects: [project],
  updatedAt: "2026-09-02T10:05:00.000Z",
};

export const uploadedResume: UploadedResume = {
  id: "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
  accountId: ACCOUNT_ID,
  createdAt: "2026-09-02T10:01:00.000Z",
  source: "upload",
  fileName: "ada-lovelace.pdf",
  contentType: "application/pdf",
  sizeBytes: 184_320,
};

export const rebuiltResume: RebuiltResume = {
  id: "d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a",
  accountId: ACCOUNT_ID,
  createdAt: "2026-09-02T11:00:00.000Z",
  source: "rebuild",
  jobDescriptionId: JOB_DESCRIPTION_ID,
  content: "# Ada Lovelace\n\nSenior Software Engineer...",
};
