import { z } from "zod";

export const ValidationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ApiErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  message: z.string(),
  error: z.string().optional(),
  issues: z.array(ValidationIssueSchema).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
