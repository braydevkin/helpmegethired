import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IngestionProgress } from "./ingestion-progress";

const stages = [
  { title: "Uploading to secure storage", detail: "Done", state: "done" as const },
  { title: "Queued for processing", detail: "Job registered and picked up by a worker.", state: "active" as const },
  { title: "Reading your résumé", detail: "Waiting", state: "waiting" as const },
];
const rows = [
  { label: "Headline", value: "Found" },
  { label: "Experience", value: undefined },
];

describe("IngestionProgress", () => {
  it("shows the file, the percentage, the stages, and the Profile data with its count", () => {
    render(
      <IngestionProgress
        file={{ name: "ada.pdf", meta: "1.8 MB · processing" }}
        percentage={25}
        stages={stages}
        rows={rows}
        found={{ found: 1, total: 2 }}
        footnote="Usually takes under a minute."
      />,
    );

    expect(screen.getByText("ada.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.8 MB · processing")).toBeInTheDocument();
    expect(screen.getByTestId("upload-percentage")).toHaveTextContent("25%");
    expect(screen.getByRole("progressbar", { name: "Upload progress" })).toHaveAttribute("aria-valuenow", "25");

    const pipeline = screen.getByRole("region", { name: "Pipeline" });

    expect(within(pipeline).getAllByRole("listitem").map((item) => item.getAttribute("data-state"))).toEqual(["done", "active", "waiting"]);
    expect(within(pipeline).getByText("Job registered and picked up by a worker.")).toBeInTheDocument();

    const data = screen.getByRole("region", { name: "Profile data" });

    expect(screen.getByTestId("profile-data-count")).toHaveTextContent("1 of 2");
    expect(within(data).getAllByRole("listitem").map((item) => item.getAttribute("data-found"))).toEqual(["true", "false"]);
    expect(within(data).getByText("Found")).toBeInTheDocument();
    expect(screen.getByText("Usually takes under a minute.")).toBeInTheDocument();
  });

  it("renders the actions it is given", () => {
    render(
      <IngestionProgress
        file={{ name: "ada.pdf", meta: "1.8 MB · processed" }}
        percentage={100}
        stages={stages}
        rows={rows}
        found={{ found: 2, total: 2 }}
        actions={<a href="/journey/profile">Review my profile</a>}
      />,
    );

    expect(screen.getByRole("link", { name: "Review my profile" })).toHaveAttribute("href", "/journey/profile");
  });
});
