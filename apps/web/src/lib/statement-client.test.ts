import { describe, expect, it, vi } from "vitest";

import { statementOf, statementsOf } from "./curation-analysis/statement.fixtures";
import { StatementClient, StatementRefusedError } from "./statement-client";

const BASE_URL = "http://api.test";

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("StatementClient", () => {
  it("lists the current Curation's Statements with the Session", async () => {
    const listed = statementsOf([statementOf(0)]);
    const fetchImplementation = vi.fn().mockResolvedValue(jsonResponse(200, listed));

    await expect(new StatementClient(BASE_URL, fetchImplementation).list("session-token")).resolves.toEqual(listed);
    expect(fetchImplementation).toHaveBeenCalledWith(
      `${BASE_URL}/profile/curation/statements`,
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ authorization: "Bearer session-token" }) }),
    );
  });

  it("sends a review and answers the reviewed Statement", async () => {
    const reviewed = statementOf(0, { review: { state: "rejected", reviewedAt: "2026-09-11T15:00:00.000Z" } });
    const fetchImplementation = vi.fn().mockResolvedValue(jsonResponse(200, reviewed));

    await expect(new StatementClient(BASE_URL, fetchImplementation).review("session-token", reviewed.id, "rejected")).resolves.toEqual(reviewed);
    expect(fetchImplementation).toHaveBeenCalledWith(
      `${BASE_URL}/profile/curation/statements/${reviewed.id}/review`,
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ state: "rejected" }) }),
    );
  });

  it("refuses with the status the API answered, as for a Statement of another Account", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(jsonResponse(404, { statusCode: 404, message: "Not Found" }));
    const refusal = new StatementClient(BASE_URL, fetchImplementation).review("session-token", statementOf(0).id, "accepted");

    await expect(refusal).rejects.toBeInstanceOf(StatementRefusedError);
    await expect(refusal).rejects.toHaveProperty("status", 404);
  });
});
