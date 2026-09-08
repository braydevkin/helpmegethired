import { randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../app.module";
import { openApiDocument } from "../openapi/document";
import { QUEUE_PREFIX } from "../queue/queues";
import { DOCS_ENABLED } from "./docs-enabled";

const start = async (enabled: boolean): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(QUEUE_PREFIX)
    .useValue(`test-${randomUUID()}`)
    .overrideProvider(DOCS_ENABLED)
    .useValue(enabled)
    .compile();
  const app = moduleRef.createNestApplication();

  await app.listen(0);

  return app;
};

describe("API docs", () => {
  describe("outside production", () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
      app = await start(true);
      baseUrl = await app.getUrl();
    });

    afterAll(async () => {
      await app.close();
    });

    it("renders Swagger UI without a Session, from assets the API serves itself", async () => {
      const page = await fetch(`${baseUrl}/docs`);

      expect(page.status).toBe(200);
      expect(page.headers.get("content-type")).toContain("text/html");
      expect(await page.text()).toContain('url: "/docs/openapi.json"');

      const stylesheet = await fetch(`${baseUrl}/docs/assets/swagger-ui.css`);
      const bundle = await fetch(`${baseUrl}/docs/assets/swagger-ui-bundle.js`);

      expect(stylesheet.status).toBe(200);
      expect(stylesheet.headers.get("content-type")).toContain("text/css");
      expect(bundle.status).toBe(200);
      expect((await fetch(`${baseUrl}/docs/assets/../package.json`)).status).toBe(404);
      expect((await fetch(`${baseUrl}/docs/assets/index.html`)).status).toBe(404);
    });

    it("serves the generated document", async () => {
      const response = await fetch(`${baseUrl}/docs/openapi.json`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(JSON.parse(JSON.stringify(openApiDocument())));
    });
  });

  describe("in production", () => {
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
      app = await start(false);
      baseUrl = await app.getUrl();
    });

    afterAll(async () => {
      await app.close();
    });

    it.each(["/docs", "/docs/openapi.json", "/docs/assets/swagger-ui.css"])("answers 404 for %s", async (path) => {
      expect((await fetch(`${baseUrl}${path}`)).status).toBe(404);
    });
  });
});
