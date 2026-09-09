import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("names the project in the main heading", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Help Me Get Hired");
  });

  it("states the project goal", () => {
    render(<HomePage />);

    expect(screen.getByText(/expands its knowledge of selection processes/)).toBeInTheDocument();
    expect(screen.getByText(/AI explains, it does not replace/)).toBeInTheDocument();
  });
});
