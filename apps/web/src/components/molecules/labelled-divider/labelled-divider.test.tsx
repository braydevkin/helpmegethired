import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LabelledDivider } from "./labelled-divider";

describe("LabelledDivider", () => {
  it("is a separator carrying its label", () => {
    render(<LabelledDivider label="New here?" />);

    expect(screen.getByRole("separator", { name: "New here?" })).toHaveTextContent("New here?");
  });
});
