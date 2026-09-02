import { BadRequestException } from "@nestjs/common";
import { ApiErrorSchema } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ZodValidationPipe } from "./zod-validation.pipe";

const schema = z.object({ email: z.email(), password: z.string().min(8) });
const pipe = new ZodValidationPipe(schema);

describe("ZodValidationPipe", () => {
  it("returns the parsed value when the schema accepts it", () => {
    const input = { email: "ada@example.com", password: "correct horse" };

    expect(pipe.transform(input)).toEqual(input);
  });

  it("rejects an invalid body with a 400 whose issues name the failing fields", () => {
    const transform = () => pipe.transform({ email: "ada", password: "short", extra: true });

    expect(transform).toThrow(BadRequestException);

    try {
      transform();
    } catch (error) {
      const body = (error as BadRequestException).getResponse();

      expect(ApiErrorSchema.safeParse(body)).toMatchObject({ success: true });
      expect(body).toMatchObject({
        statusCode: 400,
        issues: [
          { path: "email", message: expect.any(String) },
          { path: "password", message: expect.any(String) },
        ],
      });
    }
  });

  it("never echoes the submitted values in the error", () => {
    try {
      pipe.transform({ email: "ada", password: "hunter2hunter2!" });
    } catch (error) {
      expect(JSON.stringify((error as BadRequestException).getResponse())).not.toContain("hunter2");
    }
  });
});
