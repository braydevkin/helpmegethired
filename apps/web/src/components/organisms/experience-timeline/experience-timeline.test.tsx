import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExperienceTimeline } from "./experience-timeline";

const entries = [
  {
    id: "1e4b2a6c-9d3f-4e8a-b7c5-2f6a8d1c3e5b",
    role: "Senior Backend Engineer",
    company: "Northwind Labs",
    period: "2022 — present",
    description: "Owns the payments platform.",
    note: null,
    corrected: false,
    skills: ["Node.js", "NestJS"],
  },
  {
    id: "2f5c3b7d-0e4a-4f9b-8c6d-3a7b9e2d4f6c",
    role: "Freelance Developer",
    company: "Self-employed",
    period: "2017 — 2018",
    description: "Small business websites and integrations.",
    corrected: false,
    note: "Dates need confirming — the PDF lists only years.",
    skills: [],
  },
];

describe("ExperienceTimeline", () => {
  it("lists every role with its period, company, description, and skills", () => {
    render(<ExperienceTimeline entries={entries} meta="2 roles · 2017 — present" />);

    const section = screen.getByRole("region", { name: "Experience" });

    expect(within(section).getByText("2 roles · 2017 — present")).toBeInTheDocument();
    expect(within(section).getAllByRole("listitem").at(0)).toHaveTextContent("Senior Backend Engineer");
    expect(within(section).getByText("Northwind Labs")).toBeInTheDocument();
    expect(within(section).getByText("2022 — present")).toBeInTheDocument();
    expect(within(section).getByText("Node.js")).toBeInTheDocument();
  });

  it("says in place what the Ingestion could not read with confidence", () => {
    render(<ExperienceTimeline entries={entries} meta={null} />);

    expect(screen.getByText("Dates need confirming — the PDF lists only years.")).toBeInTheDocument();
  });
});
