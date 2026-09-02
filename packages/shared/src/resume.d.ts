import { z } from "zod";
export declare const UploadedResumeSchema: z.ZodObject<{
    source: z.ZodLiteral<"upload">;
    fileName: z.ZodString;
    contentType: z.ZodLiteral<"application/pdf">;
    sizeBytes: z.ZodInt;
    id: z.ZodUUID;
    accountId: z.ZodUUID;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const RebuiltResumeSchema: z.ZodObject<{
    source: z.ZodLiteral<"rebuild">;
    jobDescriptionId: z.ZodUUID;
    content: z.ZodString;
    id: z.ZodUUID;
    accountId: z.ZodUUID;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>;
export declare const ResumeSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    source: z.ZodLiteral<"upload">;
    fileName: z.ZodString;
    contentType: z.ZodLiteral<"application/pdf">;
    sizeBytes: z.ZodInt;
    id: z.ZodUUID;
    accountId: z.ZodUUID;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>, z.ZodObject<{
    source: z.ZodLiteral<"rebuild">;
    jobDescriptionId: z.ZodUUID;
    content: z.ZodString;
    id: z.ZodUUID;
    accountId: z.ZodUUID;
    createdAt: z.ZodISODateTime;
}, z.core.$strip>], "source">;
export type UploadedResume = z.infer<typeof UploadedResumeSchema>;
export type RebuiltResume = z.infer<typeof RebuiltResumeSchema>;
export type Resume = z.infer<typeof ResumeSchema>;
export type ResumeSource = Resume["source"];
//# sourceMappingURL=resume.d.ts.map