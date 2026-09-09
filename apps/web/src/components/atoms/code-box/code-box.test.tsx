import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CodeBox } from "./code-box";

describe("CodeBox", () => {
  it("is a single numeric digit box", () => {
    render(<CodeBox />);

    const box = screen.getByLabelText("Verification digit");

    expect(box).toHaveAttribute("inputmode", "numeric");
    expect(box).toHaveAttribute("maxlength", "1");
    expect(box).toHaveAttribute("type", "text");
  });
});
