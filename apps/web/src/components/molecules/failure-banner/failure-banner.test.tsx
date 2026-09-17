import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FailureBanner } from "./failure-banner";

describe("FailureBanner", () => {
  it("names what stopped, the pass it stopped on, why, and the way to pick it up again", () => {
    render(
      <FailureBanner
        title="Pass 4 could not be completed"
        subject="Freelance Developer at Self-employed"
        reason="The model did not answer in time — nothing was saved for this one."
        action={<button type="button">Try again</button>}
      />,
    );

    const banner = screen.getByRole("region", { name: "Pass 4 could not be completed" });

    expect(banner).toHaveTextContent("“Freelance Developer at Self-employed”");
    expect(banner).toHaveTextContent("The model did not answer in time — nothing was saved for this one.");
    expect(within(banner).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("leaves the pass out when no single one caused the stop", () => {
    render(<FailureBanner title="You stopped the analysis" reason="Everything saved before you stopped it is kept." action={null} />);

    expect(screen.getByRole("region", { name: "You stopped the analysis" })).not.toHaveTextContent("“");
  });
});
