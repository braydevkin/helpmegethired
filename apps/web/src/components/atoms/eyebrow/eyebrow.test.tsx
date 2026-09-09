import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Eyebrow } from "./eyebrow";

describe("Eyebrow", () => {
  it("renders the step text", () => {
    render(<Eyebrow>Step 1 of 3</Eyebrow>);

    expect(screen.getByText("Step 1 of 3")).toHaveClass("eyebrow");
  });
});
