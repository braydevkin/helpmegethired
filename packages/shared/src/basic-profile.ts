import { z } from "zod";

import { TextSchema } from "./primitives.js";

export const BasicProfileSchema = z.object({
  fullName: TextSchema,
  headline: TextSchema,
  summary: TextSchema.optional(),
  location: TextSchema.optional(),
  linkedinUrl: z.url().optional(),
});

export type BasicProfile = z.infer<typeof BasicProfileSchema>;
