import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";

describe("Badge", () => {
  it("renders the status text", () => {
    render(<Badge>Verified</Badge>);

    expect(screen.getByText("Verified")).toHaveClass("badge");
  });
});
