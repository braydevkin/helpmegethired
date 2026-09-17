import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LockedEntry } from "./locked-entry";

describe("LockedEntry", () => {
  it("shows a step that is not open yet as a focusable button that says why", () => {
    render(<LockedEntry label="Paste a job description" reason="Job matching opens once the analysis completes." />);

    const button = screen.getByRole("button", { name: "Paste a job description" });

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("Job matching opens once the analysis completes.");

    button.focus();
    expect(button).toHaveFocus();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-disabled", "true");
  });
});
