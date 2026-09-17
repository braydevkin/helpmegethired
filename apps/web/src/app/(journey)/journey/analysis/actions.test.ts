import { beforeEach, describe, expect, it, vi } from "vitest";

import { statementOf, statementsOf } from "../../../../lib/curation-analysis/statement.fixtures";
import { CurationRefusedError, curationClient } from "../../../../lib/curation-client";
import { progressOf, unitsOf } from "../../../../lib/curation-progress/curation-progress.fixtures";
import { readSessionToken } from "../../../../lib/session-cookie";
import { statementClient } from "../../../../lib/statement-client";
import { cancelCurationAction, readCurationAction, readStatementsAction, rerunCurationAction, retryCurationAction, reviewStatementAction } from "./actions";

vi.mock("../../../../lib/curation-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/curation-client")>()),
  curationClient: { read: vi.fn(), cancel: vi.fn(), retry: vi.fn(), rerun: vi.fn() },
}));
vi.mock("../../../../lib/statement-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../lib/statement-client")>()),
  statementClient: { list: vi.fn(), review: vi.fn() },
}));
vi.mock("../../../../lib/session-cookie", () => ({ readSessionToken: vi.fn() }));

const running = { progress: progressOf(unitsOf(9, 3)) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readSessionToken).mockResolvedValue("session-token");
});

describe("the analysis actions", () => {
  it("read the Curation with the last ETag", async () => {
    vi.mocked(curationClient.read).mockResolvedValue({ changed: false });

    expect(await readCurationAction('"etag-1"')).toEqual({ ok: true, value: { changed: false } });
    expect(curationClient.read).toHaveBeenCalledWith("session-token", '"etag-1"');
  });

  it("ask to sign in again without a Session, and never call the API", async () => {
    vi.mocked(readSessionToken).mockResolvedValue(undefined);

    expect(await cancelCurationAction()).toEqual({ ok: false, message: "Your session has expired. Sign in again to continue." });
    expect(curationClient.cancel).not.toHaveBeenCalled();
  });

  it("stop the analysis and answer the progress", async () => {
    vi.mocked(curationClient.cancel).mockResolvedValue(running);

    expect(await cancelCurationAction()).toEqual({ ok: true, value: running });
    expect(curationClient.cancel).toHaveBeenCalledWith("session-token");
  });

  it("explain a retry refused because the AI changed, and hand the code on", async () => {
    vi.mocked(curationClient.retry).mockRejectedValue(new CurationRefusedError("curation_model_changed", 422));

    expect(await retryCurationAction()).toEqual({
      ok: false,
      code: "curation_model_changed",
      message: "Your AI changed since this analysis started, so it can't be picked up where it stopped. Run it again with the AI you chose.",
    });
  });

  it("explain a re-run refused because nothing changed", async () => {
    vi.mocked(curationClient.rerun).mockRejectedValue(new CurationRefusedError("curation_unchanged", 422));

    expect(await rerunCurationAction()).toEqual({
      ok: false,
      code: "curation_unchanged",
      message: "Nothing has changed since this analysis ran: the same profile and the same AI would write the same statements.",
    });
  });

  it("fall back to the step's own message for a failure without a code", async () => {
    vi.mocked(curationClient.rerun).mockRejectedValue(new Error("socket hang up"));

    expect(await rerunCurationAction()).toEqual({ ok: false, message: "We couldn't start the analysis again. Try again in a moment." });
  });

  it("list the Statements of the current Curation", async () => {
    const listed = statementsOf([statementOf(0)]);

    vi.mocked(statementClient.list).mockResolvedValue(listed);

    expect(await readStatementsAction()).toEqual({ ok: true, value: listed });
  });

  it("save a review and answer the reviewed Statement", async () => {
    const reviewed = statementOf(0, { review: { state: "rejected", reviewedAt: "2026-09-11T15:00:00.000Z" } });

    vi.mocked(statementClient.review).mockResolvedValue(reviewed);

    expect(await reviewStatementAction(reviewed.id, "rejected")).toEqual({ ok: true, value: reviewed });
    expect(statementClient.review).toHaveBeenCalledWith("session-token", reviewed.id, "rejected");
  });

  it("refuse a review of something that is not a Statement id or a review state, without calling the API", async () => {
    const refused = { ok: false, message: "We couldn't save your review. Try again in a moment." };

    expect(await reviewStatementAction("../../auth/account", "rejected")).toEqual(refused);
    expect(await reviewStatementAction(statementOf(0).id, "deleted" as never)).toEqual(refused);
    expect(statementClient.review).not.toHaveBeenCalled();
  });
});
