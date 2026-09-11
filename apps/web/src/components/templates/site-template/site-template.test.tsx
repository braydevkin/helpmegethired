import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteTemplate } from "./site-template";

describe("SiteTemplate", () => {
  it("frames the step with the brand, the step label, the Candidate's initials, and the sign out", () => {
    render(
      <SiteTemplate stepLabel="Step 1 · Your résumé" candidate={{ initials: "AL", name: "Ada Lovelace", email: "ada@example.com" }} signOut={<button>Sign out</button>}>
        <p>content</p>
      </SiteTemplate>,
    );

    expect(screen.getByText("Help me get hired")).toBeInTheDocument();
    expect(screen.getByText("Step 1 · Your résumé")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent("AL");
    expect(screen.getByTestId("account-email")).toHaveTextContent("ada@example.com");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("content");
  });

  it("widens the column for a step that lays out panels of its own", () => {
    render(
      <SiteTemplate stepLabel="Step 2 · Profile analysis" candidate={{ initials: "AL", name: "Ada Lovelace", email: "ada@example.com" }} signOut={<button>Sign out</button>} wide>
        <p>content</p>
      </SiteTemplate>,
    );

    expect(screen.getByRole("main")).toHaveClass("wideMain");
    expect(screen.getByText("content").parentElement).toHaveClass("wideColumn");
  });
});
