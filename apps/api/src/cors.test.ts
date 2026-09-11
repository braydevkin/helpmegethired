import { Controller, Delete, Get, Put, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { corsOptionsFor } from "./cors";

const WEB_ORIGIN = "http://localhost:3000";

@Controller("account/model")
class ModelChoiceRoutes {
  @Get()
  read() {
    return {};
  }

  @Put()
  save() {
    return {};
  }

  @Delete("key")
  revoke() {
    return {};
  }
}

@Controller("auth")
class AccountRoutes {
  @Get("account")
  account() {
    return {};
  }
}

describe("CORS", () => {
  let app: INestApplication;
  let baseUrl: string;

  const preflight = (path: string, method: string, origin = WEB_ORIGIN) =>
    fetch(`${baseUrl}${path}`, {
      method: "OPTIONS",
      headers: { origin, "access-control-request-method": method, "access-control-request-headers": "authorization,content-type" },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ModelChoiceRoutes, AccountRoutes] }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.enableCors(corsOptionsFor(WEB_ORIGIN));
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(() => app.close());

  it("lets the web origin send the Model Key to PUT /account/model with a bearer and a JSON body, and no cookies", async () => {
    const answer = await preflight("/account/model", "PUT");

    expect(answer.status).toBe(204);
    expect(answer.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(answer.headers.get("access-control-allow-methods")).toBe("PUT");
    expect(answer.headers.get("access-control-allow-headers")).toBe("Authorization,Content-Type");
    expect(answer.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("answers the key route itself with the web origin", async () => {
    const answer = await fetch(`${baseUrl}/account/model`, { method: "PUT", headers: { origin: WEB_ORIGIN } });

    expect(answer.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
  });

  it("names only the web origin, whoever asks", async () => {
    const answer = await preflight("/account/model", "PUT", "https://elsewhere.example");

    expect(answer.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
  });

  it.each([
    ["/account/model/key", "DELETE"],
    ["/account/model/key-ticket", "POST"],
    ["/auth/account", "GET"],
  ])("gives %s no browser caller", async (path, method) => {
    const answer = await preflight(path, method);

    expect(answer.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers a plain request to another route with no CORS header", async () => {
    const answer = await fetch(`${baseUrl}/auth/account`, { headers: { origin: WEB_ORIGIN } });

    expect(answer.status).toBe(200);
    expect(answer.headers.get("access-control-allow-origin")).toBeNull();
  });
});
