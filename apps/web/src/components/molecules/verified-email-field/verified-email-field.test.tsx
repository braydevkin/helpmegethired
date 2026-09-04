import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VerifiedEmailField } from "./verified-email-field";

describe("VerifiedEmailField", () => {
  it("shows the verified email read-only with the badge", () => {
    render(<VerifiedEmailField id="email" email="ana@example.com" />);

    const input = screen.getByLabelText("Email");

    expect(input).toHaveValue("ana@example.com");
    expect(input).toHaveAttribute("readonly");
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });
});
