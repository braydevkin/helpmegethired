import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Label } from "./label";

describe("Label", () => {
  it("labels the control it points at", () => {
    render(
      <>
        <Label htmlFor="email">Email address</Label>
        <input id="email" />
      </>,
    );

    expect(screen.getByLabelText("Email address")).toHaveAttribute("id", "email");
  });
});
