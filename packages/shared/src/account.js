import { z } from "zod";
import { IdSchema, TimestampSchema } from "./primitives.js";
export const AccountSchema = z.object({
    id: IdSchema,
    email: z.email(),
    createdAt: TimestampSchema,
});
//# sourceMappingURL=account.js.map