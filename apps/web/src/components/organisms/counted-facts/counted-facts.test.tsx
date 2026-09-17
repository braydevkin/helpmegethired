import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CountedFacts } from "./counted-facts";

describe("CountedFacts", () => {
  it("lists each counted fact beside its value, labelled as coming from the dates", () => {
    render(
      <CountedFacts
        facts={[
          { label: "Career length", value: "7 yr 2 mo" },
          { label: "Roles", value: "4" },
        ]}
      />,
    );

    const panel = screen.getByRole("region", { name: "Counted, not guessed" });

    expect(panel).toHaveTextContent("These come straight from your dates. The analysis is given them as facts.");
    expect(within(panel).getByText("Career length").nextElementSibling).toHaveTextContent("7 yr 2 mo");
    expect(within(panel).getByText("Roles").nextElementSibling).toHaveTextContent("4");
  });
});
