import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StatementCard, type StatementCardProps } from "./statement-card";

const TEXT = "Cut a listing endpoint's response time by restructuring its queries.";

const cardOf = (overrides: Partial<StatementCardProps> = {}): StatementCardProps => ({
  text: TEXT,
  labels: ["Performance", "Databases"],
  quotes: [{ id: "q1", text: "restructured the listing queries" }],
  source: "Senior Backend Engineer at Northwind Labs",
  review: "unreviewed",
  saving: false,
  onReview: vi.fn(),
  ...overrides,
});

describe("StatementCard", () => {
  it("shows the Statement with its labels and the résumé line it came from", () => {
    render(<StatementCard {...cardOf()} />);

    const card = screen.getByRole("article", { name: TEXT });

    expect(within(card).getByRole("list", { name: "Labels" })).toHaveTextContent("PerformanceDatabases");
    expect(card).toHaveTextContent("From your résumé“restructured the listing queries”Senior Backend Engineer at Northwind Labs");
  });

  it("is reviewed with two native buttons the keyboard reaches", () => {
    render(<StatementCard {...cardOf()} />);

    const buttons = within(screen.getByRole("group", { name: "Your review" })).getAllByRole("button");

    expect(buttons.map((button) => button.textContent)).toEqual(["Looks right", "Reject"]);

    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      button.focus();
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("sends the answer pressed, and pressing it again takes it back", () => {
    const onReview = vi.fn();
    const { rerender } = render(<StatementCard {...cardOf({ onReview })} />);

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReview).toHaveBeenLastCalledWith("rejected");

    rerender(<StatementCard {...cardOf({ onReview, review: "rejected" })} />);

    expect(screen.getByText("Rejected · not used to match you to a job")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReview).toHaveBeenLastCalledWith("unreviewed");

    fireEvent.click(screen.getByRole("button", { name: "Looks right" }));
    expect(onReview).toHaveBeenLastCalledWith("accepted");
  });

  it("ignores a second answer while the first is being saved, and keeps the buttons focusable", () => {
    const onReview = vi.fn();

    render(<StatementCard {...cardOf({ onReview, saving: true })} />);

    const looksRight = screen.getByRole("button", { name: "Looks right" });

    fireEvent.click(looksRight);

    expect(onReview).not.toHaveBeenCalled();
    expect(looksRight).toHaveAttribute("aria-disabled", "true");
    expect(looksRight).not.toBeDisabled();
  });
});
