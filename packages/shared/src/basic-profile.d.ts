import { z } from "zod";
export declare const BasicProfileSchema: z.ZodObject<{
    fullName: z.ZodString;
    headline: z.ZodString;
    summary: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
    linkedinUrl: z.ZodOptional<z.ZodURL>;
}, z.core.$strip>;
export type BasicProfile = z.infer<typeof BasicProfileSchema>;
//# sourceMappingURL=basic-profile.d.ts.map