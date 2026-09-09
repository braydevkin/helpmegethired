import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogoMark } from "./logo-mark";

describe("LogoMark", () => {
  it("is decorative and shows the letter", () => {
    const { container } = render(<LogoMark />);

    const mark = container.firstElementChild;

    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(mark).toHaveTextContent("H");
  });
});
