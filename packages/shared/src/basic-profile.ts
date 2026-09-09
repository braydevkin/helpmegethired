import { z } from "zod";

import { TextSchema } from "./primitives.js";

// Holds no name, e-mail, phone, or address: those are Account Information.
export const BasicProfileSchema = z.strictObject({
  headline: TextSchema.nullable(),
  summary: TextSchema.nullable(),
  linkedinUrl: z.url().nullable(),
  githubUrl: z.url().nullable(),
});

export type BasicProfile = z.infer<typeof BasicProfileSchema>;

export const EMPTY_BASIC_PROFILE: BasicProfile = { headline: null, summary: null, linkedinUrl: null, githubUrl: null };
