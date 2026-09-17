import { ApiErrorSchema } from "@helpmegethired/shared";
import type { z } from "zod";

export function apiErrorCodeOf<Code extends string>(body: unknown, codes: z.ZodType<Code>): Code | undefined {
  const parsed = ApiErrorSchema.safeParse(body);
  const code = codes.safeParse(parsed.success ? parsed.data.code : undefined);

  return code.success ? code.data : undefined;
}

// A body that is not JSON, as a proxy's error page, still ends in the caller's own refusal.
export async function jsonBodyOf(response: Response, refusalOf: (body: unknown) => Error): Promise<unknown> {
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw refusalOf(body);
  }

  return body;
}
