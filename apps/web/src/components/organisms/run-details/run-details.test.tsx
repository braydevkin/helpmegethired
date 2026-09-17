import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RunDetails } from "./run-details";

describe("RunDetails", () => {
  it("names the résumé, when it was confirmed, the passes, and the AI reading it", () => {
    render(<RunDetails basedOn="ada.pdf" confirmedAt="2026-09-11T14:02:00.000Z" passes="3 saved · 6 left" readingWith="Anthropic · claude-sonnet-5" />);

    const panel = screen.getByRole("region", { name: "Run details" });

    expect(within(panel).getByText("Based on").nextElementSibling).toHaveTextContent("ada.pdf");
    expect(panel.querySelector("time")).toHaveAttribute("datetime", "2026-09-11T14:02:00.000Z");
    expect(within(panel).getByText("Passes").nextElementSibling).toHaveTextContent("3 saved · 6 left");
    expect(within(panel).getByText("Reading with").nextElementSibling).toHaveTextContent("Anthropic · claude-sonnet-5");
  });

  it("leaves out what the run does not know", () => {
    render(<RunDetails basedOn={null} confirmedAt={null} passes="0 saved · 2 left" readingWith="Anthropic · claude-sonnet-5" />);

    expect(screen.queryByText("Based on")).not.toBeInTheDocument();
    expect(screen.queryByText("Confirmed")).not.toBeInTheDocument();
  });
});
