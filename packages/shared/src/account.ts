import { z } from "zod";

import { IdSchema, TimestampSchema } from "./primitives.js";

export const AccountSchema = z.object({
  id: IdSchema,
  email: z.email(),
  createdAt: TimestampSchema,
});

export type Account = z.infer<typeof AccountSchema>;
