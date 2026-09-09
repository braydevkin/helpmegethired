import { describe, expect, it } from "vitest";

import { hasPdfSignature } from "./pdf-signature";

describe("hasPdfSignature", () => {
  it("accepts bytes that open with the PDF header", () => {
    expect(hasPdfSignature(Buffer.from("%PDF-1.7\n%âãÏÓ\n", "latin1"))).toBe(true);
  });

  it.each([
    ["an HTML page", "<!doctype html>"],
    ["a header preceded by whitespace", " %PDF-1.7"],
    ["a truncated header", "%PD"],
    ["nothing", ""],
  ])("refuses %s", (_label, bytes) => {
    expect(hasPdfSignature(Buffer.from(bytes, "latin1"))).toBe(false);
  });
});
