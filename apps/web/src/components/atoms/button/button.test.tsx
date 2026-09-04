import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("is primary by default and keeps the button semantics", () => {
    render(<Button type="submit">Send my code</Button>);

    const button = screen.getByRole("button", { name: "Send my code" });

    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveClass("primary");
  });

  it("renders the secondary variant and merges an extra class", () => {
    render(
      <Button variant="secondary" className="extra">
        Create an account
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Create an account" });

    expect(button).toHaveClass("secondary");
    expect(button).toHaveClass("extra");
    expect(button).not.toHaveClass("primary");
  });

  it("does not fire while disabled", () => {
    const onClick = vi.fn();

    render(
      <Button disabled onClick={onClick}>
        Verify and continue
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
