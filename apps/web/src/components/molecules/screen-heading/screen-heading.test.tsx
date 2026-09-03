import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScreenHeading } from "./screen-heading";

describe("ScreenHeading", () => {
  it("renders the eyebrow, the title as the page heading, and the lead", () => {
    render(
      <ScreenHeading
        eyebrow="Welcome back"
        title="Sign in to keep going"
        lead={
          <>
            We sent a 6-digit code to <strong>ana@example.com</strong>.
          </>
        }
      />,
    );

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sign in to keep going");
    expect(screen.getByText("ana@example.com").tagName).toBe("STRONG");
  });
});
