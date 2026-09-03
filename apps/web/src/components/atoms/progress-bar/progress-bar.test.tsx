import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("exposes the step as progress and fills the completed segments", () => {
    const { container } = render(<ProgressBar steps={3} completed={2} />);

    const bar = screen.getByRole("progressbar", { name: "Step 2 of 3" });

    expect(bar).toHaveAttribute("aria-valuemax", "3");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(container.querySelectorAll(".segment")).toHaveLength(3);
    expect(container.querySelectorAll(".filled")).toHaveLength(2);
  });

  it("fills nothing before the first step is done", () => {
    const { container } = render(<ProgressBar steps={3} completed={0} />);

    expect(container.querySelectorAll(".filled")).toHaveLength(0);
  });
});
