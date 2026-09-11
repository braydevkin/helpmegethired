import { describe, expect, it } from "vitest";
import { z } from "zod";

import { apiErrorCodeOf, jsonBodyOf } from "./api-response";

const CodesSchema = z.enum(["curation_active", "curation_unchanged"]);

class Refusal extends Error {
  constructor(readonly body: unknown) {
    super("refused");
  }
}

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("jsonBodyOf", () => {
  it("answers the body of an accepted response", async () => {
    await expect(jsonBodyOf(jsonResponse(200, { percentage: 40 }), (body) => new Refusal(body))).resolves.toEqual({ percentage: 40 });
  });

  it("throws the caller's refusal, built from the body of a refused response", async () => {
    const body = { statusCode: 409, message: "busy", code: "curation_active" };

    await expect(jsonBodyOf(jsonResponse(409, body), (refused) => new Refusal(refused))).rejects.toEqual(new Refusal(body));
  });

  it("still throws the caller's refusal when a refused body is not JSON", async () => {
    const refusal = jsonBodyOf(new Response("<html>Bad gateway</html>", { status: 502 }), (body) => new Refusal(body));

    await expect(refusal).rejects.toBeInstanceOf(Refusal);
    await expect(refusal).rejects.toHaveProperty("body", undefined);
  });
});

describe("apiErrorCodeOf", () => {
  it("answers a code the caller knows", () => {
    expect(apiErrorCodeOf({ statusCode: 409, message: "busy", code: "curation_active" }, CodesSchema)).toBe("curation_active");
  });

  it("answers nothing for a code the caller does not know", () => {
    expect(apiErrorCodeOf({ statusCode: 409, message: "busy", code: "resume_in_flight" }, CodesSchema)).toBeUndefined();
  });

  it("answers nothing for a body that is not an API error", () => {
    expect(apiErrorCodeOf("<html>Bad gateway</html>", CodesSchema)).toBeUndefined();
    expect(apiErrorCodeOf(undefined, CodesSchema)).toBeUndefined();
  });
});
