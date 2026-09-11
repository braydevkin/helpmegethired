import { describe, expect, it } from "vitest";

import { pollDelayMs } from "./poll-delay";

describe("pollDelayMs", () => {
  it("doubles from one second and caps at ten", () => {
    expect([0, 1, 2, 3, 4, 9].map(pollDelayMs)).toEqual([1000, 2000, 4000, 8000, 10000, 10000]);
  });
});
