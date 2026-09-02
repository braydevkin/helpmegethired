import { z } from "zod";
export declare const AccountSchema: z.ZodObject<{
    id: z.ZodUUID;
    email: z.ZodEmail;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export type Account = z.infer<typeof AccountSchema>;
//# sourceMappingURL=account.d.ts.map