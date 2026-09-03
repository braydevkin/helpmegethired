import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandPanel } from "./brand-panel";

describe("BrandPanel", () => {
  it("shows the brand, the tagline, the lead, the three claims, and the footer line", () => {
    render(<BrandPanel />);

    const panel = screen.getByRole("complementary", { name: "Help me get hired" });

    expect(within(panel).getByText("Show up to the interview already prepared.")).toBeInTheDocument();
    expect(
      within(panel).getByText(
        "Practice the interviews, sharpen the résumé, and understand the reasoning behind every step.",
      ),
    ).toBeInTheDocument();
    expect(within(panel).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "✓Mock interviews with instant feedback",
      "✓Role-matched résumé rewrites",
      "✓A study plan built from your gaps",
    ]);
    expect(within(panel).getByText("No passwords. We send a one-time code every time.")).toBeInTheDocument();
  });

  it("keeps the tagline out of the heading outline so the screen title stays the h1", () => {
    render(<BrandPanel />);

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
