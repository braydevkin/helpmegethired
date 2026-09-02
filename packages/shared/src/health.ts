import { z } from "zod";

import { TimestampSchema } from "./primitives.js";

export const HealthStatusSchema = z.object({
  status: z.literal("ok"),
  uptimeSeconds: z.number().int().nonnegative(),
  checkedAt: TimestampSchema,
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
