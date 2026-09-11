import type { CurationProgressState, CurationStatements } from "@helpmegethired/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { statementOf, statementsOf } from "../../../../lib/curation-analysis/statement.fixtures";
import { progressOf, unitOf, unitsOf } from "../../../../lib/curation-progress/curation-progress.fixtures";
import { cancelCurationAction, readCurationAction, readStatementsAction, rerunCurationAction, retryCurationAction, reviewStatementAction } from "./actions";
import { AnalysisFlow } from "./analysis-flow";

vi.mock("./actions", () => ({
  readCurationAction: vi.fn(),
  cancelCurationAction: vi.fn(),
  retryCurationAction: vi.fn(),
  rerunCurationAction: vi.fn(),
  readStatementsAction: vi.fn(),
  reviewStatementAction: vi.fn(),
}));

const run = { basedOn: "ada-lovelace.pdf", confirmedAt: "2026-09-11T14:02:00.000Z" };
const links = { journey: "/journey", modelChoice: "/journey/ai" };
const UNCHANGED = "Nothing has changed since this analysis ran: the same profile and the same AI would write the same statements.";
const MODEL_CHANGED = "Your AI changed since this analysis started, so it can't be picked up where it stopped. Run it again with the AI you chose.";

const noStatements = statementsOf([], null);
const found = statementsOf([statementOf(0), statementOf(1)]);
const running: CurationProgressState = { progress: progressOf(unitsOf(9, 3)) };
const completed: CurationProgressState = { progress: progressOf(unitsOf(9, 9, 0), { status: "completed" }) };
const failed: CurationProgressState = {
  progress: progressOf([...unitsOf(3, 3, 0), unitOf(3, { status: "failed", failureReason: "timeout" }), ...[4, 5, 6, 7, 8].map((index) => unitOf(index))], {
    status: "failed",
    failureReason: "attempts_exhausted",
  }),
};

const renderFlow = (initial: CurationProgressState, statements: CurationStatements = noStatements) =>
  render(<AnalysisFlow initial={initial} initialStatements={statements} run={run} links={links} />);

const firstStatement = () => screen.getByRole("article", { name: /^Statement 1:/ });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readCurationAction).mockResolvedValue({ ok: true, value: { changed: false } });
});

describe("AnalysisFlow", () => {
  it("shows a running analysis: the pass being read, every pass, the counted facts and the run details", () => {
    renderFlow(running);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Understanding what you have done");
    expect(screen.getByRole("region", { name: "Pass 4 of 9 · Role 4 at Company 4" })).toBeInTheDocument();
    expect(screen.getByTestId("analysis-percentage")).toHaveTextContent("33%");
    expect(within(screen.getByRole("list", { name: "Every pass" })).getAllByRole("listitem")).toHaveLength(9);

    const facts = screen.getByRole("region", { name: "Counted, not guessed" });

    expect(within(facts).getByText("Career length").nextElementSibling).toHaveTextContent("7 yr 2 mo");
    expect(within(facts).getByText("Longest tenure").nextElementSibling).toHaveTextContent("Northwind Labs, 4 yr");

    const details = screen.getByRole("region", { name: "Run details" });

    expect(details).toHaveTextContent("ada-lovelace.pdf");
    expect(details).toHaveTextContent("3 saved · 6 left");
    expect(details).toHaveTextContent("Anthropic · claude-sonnet-5");
  });

  it("keeps job matching locked until the analysis completes, and says why", () => {
    renderFlow(running);

    const entry = screen.getByRole("button", { name: "Paste a job description" });

    expect(entry).toHaveAttribute("aria-disabled", "true");
    expect(entry).toHaveAccessibleDescription("Job matching opens once the analysis completes: it reads these statements, not your PDF.");
  });

  it.each([
    ["running", running],
    ["failed", failed],
    ["completed", completed],
  ])("shows no cost, token count or duration while %s", (_, state) => {
    renderFlow(state, found);

    expect(document.body.textContent).not.toMatch(/cost|price|charge|token|minute|second|hour|\$/i);
  });

  it("stops the analysis and shows what the API answered", async () => {
    vi.mocked(cancelCurationAction).mockResolvedValue({ ok: true, value: { progress: progressOf(unitsOf(9, 3, 0), { status: "cancelled" }) } });

    renderFlow(running);
    fireEvent.click(screen.getByRole("button", { name: "Stop the analysis" }));

    expect(await screen.findByRole("heading", { level: 1, name: "You stopped the analysis" })).toBeInTheDocument();
    expect(cancelCurationAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop the analysis" })).not.toBeInTheDocument();
  });

  it("names the pass that failed, keeps what was saved, and tries again from where it stopped", async () => {
    vi.mocked(retryCurationAction).mockResolvedValue({ ok: true, value: { progress: progressOf(unitsOf(9, 3, 0), { status: "queued" }) } });

    renderFlow(failed);

    const banner = screen.getByRole("region", { name: "Pass 4 could not be completed" });

    expect(banner).toHaveTextContent("“Role 4 at Company 4”");
    expect(banner).toHaveTextContent("The model did not answer in time — nothing was saved for this one.");

    fireEvent.click(within(banner).getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Understanding what you have done" })).toBeInTheDocument();
    expect(retryCurationAction).toHaveBeenCalledTimes(1);
  });

  it("steers to a re-run when the AI changed since the analysis started", async () => {
    vi.mocked(retryCurationAction).mockResolvedValue({ ok: false, code: "curation_model_changed", message: MODEL_CHANGED });
    vi.mocked(rerunCurationAction).mockResolvedValue({ ok: true, value: running });

    renderFlow(failed);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(MODEL_CHANGED);

    const runAgain = screen.getByRole("button", { name: "Run it again" });

    await waitFor(() => expect(runAgain).toHaveAttribute("aria-disabled", "false"));
    fireEvent.click(runAgain);

    await waitFor(() => expect(rerunCurationAction).toHaveBeenCalledTimes(1));
  });

  it("sends the Candidate to save a new key when the provider refused the stored one", () => {
    renderFlow({ progress: progressOf(unitsOf(9, 3, 0), { status: "failed", failureReason: "model_key_rejected" }) });

    const banner = screen.getByRole("region", { name: "Your AI provider refused your key" });

    expect(within(banner).getByRole("link", { name: "Save a new key" })).toHaveAttribute("href", "/journey/ai");
    expect(within(banner).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("lists the Statements with their Evidence, and a rejected one is marked as not used", async () => {
    vi.mocked(reviewStatementAction).mockResolvedValue({ ok: true, value: statementOf(0, { review: { state: "rejected", reviewedAt: "2026-09-11T15:00:00.000Z" } }) });

    renderFlow(completed, found);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("We know your profile now");
    expect(firstStatement()).toHaveTextContent("From your résumé“restructured the listing queries”Role 1 at Company 1");

    fireEvent.click(within(firstStatement()).getByRole("button", { name: "Reject" }));

    expect(await within(firstStatement()).findByText("Rejected · not used to match you to a job")).toBeInTheDocument();
    expect(within(firstStatement()).getByRole("button", { name: "Reject" })).toHaveAttribute("aria-pressed", "true");
    expect(reviewStatementAction).toHaveBeenCalledWith(statementOf(0).id, "rejected");
    expect(screen.getByText("2 statements · 1 rejected, not used")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paste a job description" })).toHaveAccessibleDescription("Job matching is the next step of the journey and is not open yet.");
  });

  it("says so when a review could not be saved, and keeps the Statement as it was", async () => {
    vi.mocked(reviewStatementAction).mockResolvedValue({ ok: false, message: "We couldn't save your review. Try again in a moment." });

    renderFlow(completed, found);
    fireEvent.click(within(firstStatement()).getByRole("button", { name: "Looks right" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't save your review. Try again in a moment.");
    expect(within(firstStatement()).getByRole("button", { name: "Looks right" })).toHaveAttribute("aria-pressed", "false");
  });

  it("disables Run it again with its reason before any click when the progress says a re-run is refused", () => {
    renderFlow({ progress: progressOf(unitsOf(9, 9, 0), { status: "completed", rerun: { allowed: false, refusal: "curation_unchanged" } }) }, found);

    const runAgain = screen.getByRole("button", { name: "Run it again" });

    expect(runAgain).toHaveAttribute("aria-disabled", "true");
    expect(runAgain).toHaveAccessibleDescription(UNCHANGED);

    fireEvent.click(runAgain);

    expect(rerunCurationAction).not.toHaveBeenCalled();
  });

  it("disables Run it again with the API's reason when a re-run the progress allowed is refused anyway", async () => {
    vi.mocked(rerunCurationAction).mockResolvedValue({ ok: false, code: "curation_unchanged", message: UNCHANGED });

    renderFlow(completed, found);
    fireEvent.click(screen.getByRole("button", { name: "Run it again" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Run it again" })).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("button", { name: "Run it again" })).toHaveAccessibleDescription(UNCHANGED);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run it again" }));

    expect(rerunCurationAction).toHaveBeenCalledTimes(1);
  });

  it("reads the Statements once a run completes while the page is open", async () => {
    vi.mocked(readCurationAction).mockResolvedValue({ ok: true, value: { changed: true, state: completed, etag: '"2"' } });
    vi.mocked(readStatementsAction).mockResolvedValue({ ok: true, value: found });

    renderFlow(running);

    expect(await screen.findByRole("heading", { level: 1, name: "We know your profile now" }, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByRole("article", { name: /^Statement 1:/ })).toBeInTheDocument();
    expect(readStatementsAction).toHaveBeenCalledTimes(1);
  });

  it("shows the last completed Statements while a newer run is in flight", () => {
    renderFlow(running, found);

    expect(screen.getByText("These come from your last completed analysis, which stays in use until the new one completes.")).toBeInTheDocument();
    expect(firstStatement()).toBeInTheDocument();
  });

  it("leads back to the journey when a newer résumé replaced the analysis", () => {
    renderFlow({ progress: null });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("A newer résumé replaced this analysis");
    expect(screen.getByRole("link", { name: "Back to your journey" })).toHaveAttribute("href", "/journey");
  });
});
