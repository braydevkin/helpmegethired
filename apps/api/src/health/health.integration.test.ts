import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { HealthStatusSchema } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";

describe("GET /health", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it("responds with a health status the shared schema accepts", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(HealthStatusSchema.safeParse(await response.json())).toMatchObject({ success: true });
  });
});
