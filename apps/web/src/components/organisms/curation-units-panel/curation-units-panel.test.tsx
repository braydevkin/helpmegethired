import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { unitOf, unitsOf } from "../../../lib/curation-progress/curation-progress.fixtures";
import { CurationUnitsPanel } from "./curation-units-panel";

describe("CurationUnitsPanel", () => {
  it("lists every pass with its kind and status, and counts the saved ones", () => {
    render(
      <CurationUnitsPanel
        units={[
          unitOf(0, { status: "saved" }),
          unitOf(1, { kind: "project", title: "Queue Inspector" }),
          unitOf(2, { kind: "cross_cutting", title: "Skills that repeat across roles" }),
          unitOf(3, { kind: "synthesis", title: "Your overall picture", status: "failed", failureReason: "provider_error" }),
        ]}
        saved={1}
      />,
    );

    const panel = screen.getByRole("region", { name: "What we are reading" });
    const passes = within(panel).getAllByRole("listitem");

    expect(panel).toHaveTextContent("1 of 4 saved");
    expect(passes[0]).toHaveTextContent("Role 1 at Company 1 RoleSaved");
    expect(passes[1]).toHaveTextContent("Queue Inspector ProjectWaiting");
    expect(passes[2]).toHaveTextContent("Skills that repeat across roles Across allWaiting");
    expect(passes[3]).toHaveTextContent("Your overall picture SummaryYour AI provider returned an error — nothing was saved for this one.Failed");
    expect(passes[3]).toHaveAttribute("data-state", "failed");
  });

  it.each([1, 40])("renders %i passes", (total) => {
    render(<CurationUnitsPanel units={unitsOf(total, 0)} saved={0} />);

    expect(within(screen.getByRole("list", { name: "Every pass" })).getAllByRole("listitem")).toHaveLength(total);
  });
});
