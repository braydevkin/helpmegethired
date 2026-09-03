import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Hint } from "./hint";

describe("Hint", () => {
  it("renders the helper text with its id", () => {
    render(<Hint id="address-hint">Helps us surface roles near you and flag relocation offers.</Hint>);

    expect(screen.getByText(/Helps us surface roles/)).toHaveAttribute("id", "address-hint");
  });
});
