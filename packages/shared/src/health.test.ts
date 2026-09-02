import { describe, expect, it } from "vitest";

import { HealthStatusSchema } from "./health.js";

const healthy = {
  status: "ok",
  uptimeSeconds: 42,
  checkedAt: "2026-09-02T12:00:00.000Z",
};

describe("HealthStatusSchema", () => {
  it("accepts an ok status with a whole uptime and a timestamp", () => {
    expect(HealthStatusSchema.safeParse(healthy).success).toBe(true);
  });

  it.each([
    ["a status other than ok", { ...healthy, status: "degraded" }],
    ["a negative uptime", { ...healthy, uptimeSeconds: -1 }],
    ["a fractional uptime", { ...healthy, uptimeSeconds: 1.5 }],
    ["a date without time", { ...healthy, checkedAt: "2026-09-02" }],
  ])("rejects %s", (_label, input) => {
    expect(HealthStatusSchema.safeParse(input).success).toBe(false);
  });
});
