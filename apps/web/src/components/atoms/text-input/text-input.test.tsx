import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextInput } from "./text-input";

describe("TextInput", () => {
  it("is a regular height control by default", () => {
    render(<TextInput aria-label="Email address" type="email" />);

    const input = screen.getByLabelText("Email address");

    expect(input).toHaveClass("regular");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("marks itself invalid and switches to the compact height", () => {
    render(<TextInput aria-label="Name" density="compact" invalid />);

    const input = screen.getByLabelText("Name");

    expect(input).toHaveClass("compact");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
