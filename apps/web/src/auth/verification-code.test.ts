import { VerificationCodeSchema } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { generateVerificationCode } from "./verification-code";

const SAMPLE_SIZE = 500;

describe("generateVerificationCode", () => {
  it("produces a code the shared schema accepts", () => {
    for (let index = 0; index < SAMPLE_SIZE; index += 1) {
      expect(VerificationCodeSchema.safeParse(generateVerificationCode()).success).toBe(true);
    }
  });

  it("keeps leading zeros so every code has six digits", () => {
    const codes = Array.from({ length: SAMPLE_SIZE }, generateVerificationCode);

    expect(codes.every((code) => code.length === 6)).toBe(true);
  });

  it("does not repeat itself across a sample", () => {
    const codes = new Set(Array.from({ length: SAMPLE_SIZE }, generateVerificationCode));

    expect(codes.size).toBeGreaterThan(SAMPLE_SIZE * 0.9);
  });
});
