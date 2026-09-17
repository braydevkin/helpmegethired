import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { statementOf } from "../../../lib/curation-analysis/statement.fixtures";
import { StatementList } from "./statement-list";

describe("StatementList", () => {
  it("lists the Statements under their count and sends a review with the Statement's id", () => {
    const onReview = vi.fn();

    render(<StatementList statements={[statementOf(0), statementOf(1)]} summary="2 statements" onReview={onReview} />);

    const list = screen.getByRole("region", { name: "What the analysis found" });

    expect(list).toHaveTextContent("2 statements");
    expect(list).toHaveTextContent("nothing you reject is used to match you to a job");

    fireEvent.click(within(screen.getByRole("article", { name: /^Statement 2:/ })).getByRole("button", { name: "Reject" }));

    expect(onReview).toHaveBeenCalledWith(statementOf(1).id, "rejected");
  });

  it("marks the Statement whose review is being saved", () => {
    render(<StatementList statements={[statementOf(0)]} summary="1 statement" reviewing={statementOf(0).id} onReview={vi.fn()} />);

    expect(screen.getByRole("article", { name: /^Statement 1:/ })).toHaveAttribute("aria-busy", "true");
  });

  it("says where the Statements come from while a newer analysis runs", () => {
    render(<StatementList statements={[statementOf(0)]} summary="1 statement" note="These come from your last completed analysis." onReview={vi.fn()} />);

    expect(screen.getByText("These come from your last completed analysis.")).toBeInTheDocument();
  });

  it("says so when the analysis found nothing to quote", () => {
    render(<StatementList statements={[]} summary="0 statements" onReview={vi.fn()} />);

    expect(screen.getByText("The analysis found nothing it could quote from your résumé.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
