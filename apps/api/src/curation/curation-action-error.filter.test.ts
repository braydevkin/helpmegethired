import { CurationActionErrorCodeSchema } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { apiErrorOf } from "./curation-action-error.filter";
import { CurationActionRefusedError } from "./curation-errors";

describe("apiErrorOf", () => {
  it("answers 409 only for a Curation already queued or running", () => {
    const conflicts = CurationActionErrorCodeSchema.options.filter((code) => apiErrorOf(new CurationActionRefusedError(code, "refused")).statusCode === 409);

    expect(conflicts).toEqual(["curation_active"]);
  });

  it("answers 404 when there is nothing to act on, and 422 for every refusal with a reason", () => {
    expect(apiErrorOf(new CurationActionRefusedError("curation_not_found", "No Curation"))).toEqual({
      statusCode: 404,
      message: "No Curation",
      error: "Not Found",
      code: "curation_not_found",
    });

    for (const code of ["curation_not_ready", "curation_not_retryable", "curation_model_changed", "curation_unchanged"] as const) {
      expect(apiErrorOf(new CurationActionRefusedError(code, "refused"))).toMatchObject({ statusCode: 422, error: "Unprocessable Entity", code });
    }
  });
});
