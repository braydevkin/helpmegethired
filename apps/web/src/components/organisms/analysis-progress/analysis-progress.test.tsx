import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { progressOf, unitOf, unitsOf } from "../../../lib/curation-progress/curation-progress.fixtures";
import { AnalysisProgress } from "./analysis-progress";

const passes = () => within(screen.getByRole("list", { name: "Passes" })).getAllByRole("listitem");

const spokenTextOf = (item: HTMLElement): string =>
  Array.from(item.children)
    .filter((child) => child.getAttribute("aria-hidden") !== "true")
    .map((child) => child.textContent)
    .join("");

describe("AnalysisProgress", () => {
  it("renders the API's percentage, the pass being read, and the window around it", () => {
    render(<AnalysisProgress progress={progressOf(unitsOf(9, 3))} />);

    expect(screen.getByRole("region", { name: "Understanding what you have done" })).toBeInTheDocument();
    expect(screen.getByTestId("analysis-percentage")).toHaveTextContent("33%");
    expect(screen.getByRole("progressbar", { name: "Analysis progress" })).toHaveAttribute("aria-valuenow", "33");
    expect(screen.getByText("Pass 4 of 9 · Role 4 at Company 4")).toBeInTheDocument();
    expect(screen.getByTestId("analysis-saved")).toHaveTextContent("3 of 9 saved");
    expect(passes().map((item) => item.getAttribute("data-state"))).toEqual(["done", "active", "waiting", "waiting", "waiting"]);
    expect(passes().map(spokenTextOf)).toEqual([
      "Role 3 at Company 3Saved",
      "Role 4 at Company 4Reading",
      "Role 5 at Company 5Waiting",
      "Role 6 at Company 6Waiting",
      "Role 7 at Company 7Waiting",
    ]);
    expect(screen.getByRole("list", { name: "Counted from your dates" })).toHaveTextContent("7 yr 2 mo career4 roles3 projects");
    expect(screen.getByText("Safe to close this tab — progress counts passes actually saved, so it reads the same when you come back.")).toBeInTheDocument();
  });

  it("shows the same figure when the same payload is rendered again, as after a reload", () => {
    const progress = progressOf(unitsOf(7, 5));
    const first = render(<AnalysisProgress progress={progress} />);
    const before = screen.getByTestId("analysis-percentage").textContent;

    first.unmount();
    render(<AnalysisProgress progress={structuredClone(progress)} />);

    expect(before).toBe("71%");
    expect(screen.getByTestId("analysis-percentage")).toHaveTextContent("71%");
  });

  it("renders a Profile with a single pass", () => {
    render(<AnalysisProgress progress={progressOf([unitOf(0, { kind: "synthesis", title: "The whole career, read together", status: "running" })])} />);

    expect(passes()).toHaveLength(1);
    expect(screen.getByTestId("analysis-percentage")).toHaveTextContent("0%");
    expect(screen.getByText("Pass 1 of 1 · The whole career, read together")).toBeInTheDocument();
  });

  it("renders forty passes as a window of five around the one being read", () => {
    render(<AnalysisProgress progress={progressOf(unitsOf(40, 30, 3))} />);

    expect(passes()).toHaveLength(5);
    expect(passes()[0]).toHaveTextContent("Role 30 at Company 30Saved");
    expect(screen.getByTestId("analysis-percentage")).toHaveTextContent("75%");
    expect(screen.getByTestId("analysis-saved")).toHaveTextContent("30 of 40 saved");
  });

  it("says when a paused Curation resumes, as a status a screen reader announces", () => {
    render(<AnalysisProgress progress={progressOf(unitsOf(9, 3, 0), { status: "queued", resumeAfter: "2026-09-11T14:32:00.000Z" })} />);

    expect(screen.getByRole("region", { name: "Paused for a moment" })).toHaveAttribute("data-phase", "paused");

    const notice = screen.getByRole("status");

    expect(notice).toHaveTextContent(/^Paused by your AI provider\. Resumes at \d{2}:\d{2}\.$/);
    expect(within(notice).getByText(/\d{2}:\d{2}/).tagName).toBe("TIME");
    expect(within(notice).getByText(/\d{2}:\d{2}/)).toHaveAttribute("datetime", "2026-09-11T14:32:00.000Z");
  });

  it("marks a failed pass apart and writes out what happened to it", () => {
    const list = [unitOf(0, { status: "saved" }), unitOf(1, { status: "saved" }), unitOf(2, { status: "failed", failureReason: "timeout" }), unitOf(3), unitOf(4)];

    render(<AnalysisProgress progress={progressOf(list, { status: "failed", failureReason: "attempts_exhausted" })} />);

    expect(screen.getByRole("region", { name: "The analysis stopped partway" })).toHaveAttribute("data-phase", "failed");
    expect(screen.getByText("Stopped after 2 of 5 passes")).toBeInTheDocument();

    const failed = passes().find((item) => item.getAttribute("data-state") === "failed");

    expect(failed).toHaveTextContent("Role 3 at Company 3The model did not answer in time — nothing was saved for this one.Failed");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing is lost. Your profile is untouched and every saved pass is kept.")).toBeInTheDocument();
  });

  it.each([
    ["queued", null],
    ["running", null],
    ["completed", null],
    ["failed", "model_key_rejected"],
    ["cancelled", null],
    ["superseded", null],
  ] as const)("promises no duration and quotes no cost while %s", (status, failureReason) => {
    const { container } = render(<AnalysisProgress progress={progressOf(unitsOf(6, status === "completed" ? 6 : 2, 0), { status, failureReason })} />);

    expect(container.textContent).not.toMatch(/\$|cost|price|token|minute|second|hour|usually|about \d/i);
  });
});
