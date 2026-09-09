import { z } from "zod";

export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

export const TimestampSchema = z.iso.datetime();
export type Timestamp = z.infer<typeof TimestampSchema>;

export const CalendarDateSchema = z.iso.date();
export type CalendarDate = z.infer<typeof CalendarDateSchema>;

export const TextSchema = z.string().trim().min(1);

// No list the API answers or accepts holds more than this; every list schema says so.
export const MAX_LIST_ITEMS = 1000;

export const listOf = <Item extends z.ZodType>(item: Item) => z.array(item).max(MAX_LIST_ITEMS);

export const SkillListSchema = listOf(TextSchema).default([]);
