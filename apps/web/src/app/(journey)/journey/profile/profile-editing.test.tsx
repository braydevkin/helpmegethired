import type { BasicProfile, Experience } from "@helpmegethired/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BasicProfileCorrections } from "./basic-profile-corrections";
import { ExperienceCorrections } from "./experience-corrections";
import { ProfileEditingProvider } from "./profile-editing";
import { ProfileReviewActions } from "./profile-review-actions";

const basicProfile: BasicProfile = { headline: "Backend engineer", summary: null, linkedinUrl: null, githubUrl: null };

const experience: Experience = {
  id: "1e4b2a6c-9d3f-4e8a-b7c5-2f6a8d1c3e5b",
  role: "Senior Backend Engineer",
  company: "Northwind Labs",
  period: { start: "2022-03", end: null },
  description: null,
  skills: [],
};

const renderStep = () =>
  render(
    <ProfileEditingProvider>
      <ProfileReviewActions uploadHref="/journey/resume" analysisHref="/journey/analysis" confirmed={false} confirm={vi.fn()} />
      <BasicProfileCorrections basicProfile={basicProfile} corrected={false} editable save={vi.fn()} />
      <ExperienceCorrections
        entries={[{ ...experience, period: "2022 — present", note: null, corrected: false }]}
        experiences={[experience]}
        meta="1 role"
        editable
        save={vi.fn()}
        remove={vi.fn()}
      />
    </ProfileEditingProvider>,
  );

describe("ProfileEditingProvider", () => {
  it("keeps one correction open across the cards and holds Confirm back until it closes", () => {
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Correct this" }));

    expect(screen.queryByRole("button", { name: "Correct this role: Senior Backend Engineer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a role" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm profile" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Correct this" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Correct this role: Senior Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm profile" })).toBeEnabled();
  });

  it("hides the Basic Profile correction while a role is open", () => {
    renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Add a role" }));

    expect(screen.queryByRole("button", { name: "Correct this" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm profile" })).toBeDisabled();
  });

  it("offers nothing to correct and keeps Confirm free when the Profile is not correctable", () => {
    render(
      <ProfileEditingProvider>
        <ProfileReviewActions uploadHref="/journey/resume" analysisHref="/journey/analysis" confirmed={false} confirm={vi.fn()} />
        <BasicProfileCorrections basicProfile={basicProfile} corrected={false} editable={false} save={vi.fn()} />
      </ProfileEditingProvider>,
    );

    expect(screen.queryByRole("button", { name: "Correct this" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm profile" })).toBeEnabled();
  });
});
