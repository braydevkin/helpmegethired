import { z } from "zod";

export const ValidationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

// More issues than fields in any request body; keeps the answer bounded for the client.
export const MAX_VALIDATION_ISSUES = 100;

export const ApiErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  message: z.string(),
  error: z.string().optional(),
  code: z.string().optional(),
  issues: z.array(ValidationIssueSchema).max(MAX_VALIDATION_ISSUES).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
