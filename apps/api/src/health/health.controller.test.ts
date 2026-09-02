import { Test } from "@nestjs/testing";
import { HealthStatusSchema } from "@helpmegethired/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { HealthController } from "./health.controller";
import { HealthModule } from "./health.module";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] }).compile();

    controller = moduleRef.get(HealthController);
  });

  it("reports an ok status that matches the shared schema", () => {
    const status = controller.check();

    expect(HealthStatusSchema.safeParse(status).success).toBe(true);
    expect(status.status).toBe("ok");
  });

  it("reports the uptime as whole seconds", () => {
    expect(Number.isInteger(controller.check().uptimeSeconds)).toBe(true);
  });
});
