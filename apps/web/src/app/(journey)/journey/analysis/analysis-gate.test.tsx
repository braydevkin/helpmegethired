import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisGate } from "./analysis-gate";

describe("AnalysisGate", () => {
  it("names the fields that still need a decision and leads back to the Profile", () => {
    render(<AnalysisGate notice={{ title: "2 fields still need a decision", detail: "Your location needs a second look." }} reviewHref="/journey/profile" laterHref="/journey" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Confirm your profile to start the analysis");
    expect(screen.getByText("Waiting on you")).toHaveClass("warning");
    expect(screen.getByRole("status")).toHaveTextContent("2 fields still need a decisionYour location needs a second look.");
    expect(screen.getByRole("link", { name: "Review and confirm profile" })).toHaveAttribute("href", "/journey/profile");
    expect(screen.getByRole("link", { name: "Remind me later" })).toHaveAttribute("href", "/journey");
  });

  it("keeps job matching locked, and says why", () => {
    render(<AnalysisGate notice={{ title: "Nothing was flagged", detail: "Look your profile over." }} reviewHref="/journey/profile" laterHref="/journey" />);

    expect(screen.getByRole("button", { name: "Paste a job description" })).toHaveAccessibleDescription(
      "Job matching opens once the analysis completes: it reads these statements, not your PDF.",
    );
  });
});
