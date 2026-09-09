import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DoneCard } from "./done-card";

describe("DoneCard", () => {
  it("welcomes the Candidate by name and points at the journey", () => {
    render(<DoneCard name="Ada" journeyHref="/journey" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You're in, Ada");
    expect(screen.getByText(/upload your résumé and we'll build your Profile/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to my dashboard" })).toHaveAttribute("href", "/journey");
  });
});
