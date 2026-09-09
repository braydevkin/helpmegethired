import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountTemplate } from "./account-template";

describe("AccountTemplate", () => {
  it("places the brand panel beside the form column and renders the page inside the card", () => {
    render(
      <AccountTemplate>
        <h1>Sign in to keep going</h1>
      </AccountTemplate>,
    );

    expect(screen.getByRole("complementary", { name: "Help me get hired" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { level: 1 }));
    expect(screen.getByRole("heading", { level: 1 }).parentElement).toHaveClass("card");
  });
});
