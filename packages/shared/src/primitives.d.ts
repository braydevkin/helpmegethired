import { z } from "zod";
export declare const IdSchema: z.ZodUUID;
export type Id = z.infer<typeof IdSchema>;
export declare const TimestampSchema: z.ZodISODateTime;
export type Timestamp = z.infer<typeof TimestampSchema>;
export declare const CalendarDateSchema: z.ZodISODate;
export type CalendarDate = z.infer<typeof CalendarDateSchema>;
export declare const TextSchema: z.ZodString;
export declare const SkillListSchema: z.ZodDefault<z.ZodArray<z.ZodString>>;
//# sourceMappingURL=primitives.d.ts.map