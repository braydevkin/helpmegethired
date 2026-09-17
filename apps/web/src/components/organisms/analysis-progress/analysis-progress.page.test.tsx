import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { progressOf, unitsOf } from "../../../lib/curation-progress/curation-progress.fixtures";
import { AnalysisProgress } from "./analysis-progress";

describe("AnalysisProgress on the analysis page", () => {
  it("titles the card with the pass being read and leaves the passes and the facts to the page", () => {
    render(<AnalysisProgress progress={progressOf(unitsOf(9, 3))} variant="page" />);

    expect(screen.getByRole("region", { name: "Pass 4 of 9 · Role 4 at Company 4" })).toBeInTheDocument();
    expect(screen.getByTestId("analysis-percentage")).toHaveTextContent("33%");
    expect(screen.getByTestId("analysis-saved")).toHaveTextContent("3 of 9 saved");
    expect(screen.queryByRole("list", { name: "Passes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Counted from your dates" })).not.toBeInTheDocument();
  });
});
