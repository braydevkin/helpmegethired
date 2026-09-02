import { z } from "zod";
export const IdSchema = z.uuid();
export const TimestampSchema = z.iso.datetime();
export const CalendarDateSchema = z.iso.date();
export const TextSchema = z.string().trim().min(1);
export const SkillListSchema = z.array(TextSchema).default([]);
//# sourceMappingURL=primitives.js.map