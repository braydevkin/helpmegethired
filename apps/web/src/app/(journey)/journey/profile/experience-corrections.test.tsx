import type { Experience } from "@helpmegethired/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CorrectionAction, CorrectionResult } from "../../../../lib/profile/correction-form";
import type { ExperienceEntry } from "../../../../components/organisms/experience-timeline/experience-timeline";
import { ExperienceCorrections } from "./experience-corrections";
import { ProfileEditingProvider } from "./profile-editing";

const entries: ExperienceEntry[] = [
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
    company: null,
    period: "2017 — 2018",
    description: null,
    note: "Dates need confirming.",
    corrected: true,
    skills: [],
  },
];

const experiences: Experience[] = [
  {
    id: "1e4b2a6c-9d3f-4e8a-b7c5-2f6a8d1c3e5b",
    role: "Senior Backend Engineer",
    company: "Northwind Labs",
    period: { start: "2022-03", end: null },
    description: "Owns the payments platform.",
    skills: ["Node.js", "NestJS"],
  },
  {
    id: "2f5c3b7d-0e4a-4f9b-8c6d-3a7b9e2d4f6c",
    role: "Freelance Developer",
    company: null,
    period: { start: "2017-01", end: "2018-06" },
    description: null,
    skills: [],
  },
];

const saved: CorrectionAction = () => Promise.resolve({ ok: true });
const removed = (): Promise<CorrectionResult> => Promise.resolve({ ok: true });

const renderCorrections = ({ save = vi.fn(saved), remove = vi.fn(removed), editable = true, shown = entries } = {}) => ({
  save,
  remove,
  ...render(
    <ProfileEditingProvider>
      <ExperienceCorrections entries={shown} experiences={experiences} meta="2 roles" editable={editable} save={save} remove={remove} />
    </ProfileEditingProvider>,
  ),
});

const CORRECT_FIRST = "Correct this role: Senior Backend Engineer";

const correctFirst = () => fireEvent.click(screen.getByRole("button", { name: CORRECT_FIRST }));

const refusedOn = (issues: Record<string, string>) =>
  vi.fn<CorrectionAction>(() => Promise.resolve({ ok: false, message: "Some fields need a change before this can be saved.", issues }));

describe("ExperienceCorrections", () => {
  it("marks the roles the Candidate has corrected", () => {
    renderCorrections();

    expect(screen.getByText("Corrected by you")).toBeInTheDocument();
  });

  it("offers nothing to correct once the Profile is confirmed", () => {
    renderCorrections({ editable: false });

    expect(screen.queryByRole("button", { name: /Correct this role/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a role" })).not.toBeInTheDocument();
  });

  it("names the role each button acts on", () => {
    renderCorrections();

    expect(screen.getByRole("button", { name: "Correct this role: Freelance Developer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Freelance Developer" })).toBeInTheDocument();
  });

  it("says the résumé listed no roles and still offers to add one", () => {
    renderCorrections({ shown: [] });

    expect(screen.getByText("Your résumé listed no roles.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a role" })).toBeInTheDocument();
  });

  it("opens one role at a time, with the months the Experience carries and not the ones on screen", () => {
    renderCorrections();
    correctFirst();

    expect(screen.getByRole("group", { name: "Correcting Senior Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2022-03");
    expect(screen.getByLabelText("To")).toHaveValue("");
    expect(screen.getByLabelText("Skills")).toHaveValue("Node.js, NestJS");
    expect(screen.queryByRole("button", { name: /Correct this role/ })).not.toBeInTheDocument();
  });

  it("sends the correction with the id of the role it belongs to", async () => {
    const { save } = renderCorrections();

    correctFirst();
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Staff Backend Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(save).toHaveBeenCalled());

    const form = save.mock.calls[0]![1];

    expect(form.get("id")).toBe(entries[0]!.id);
    expect(form.get("role")).toBe("Staff Backend Engineer");
  });

  it("adds a role the résumé never held, with no id", async () => {
    const { save } = renderCorrections();

    fireEvent.click(screen.getByRole("button", { name: "Add a role" }));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Volunteer Developer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(save).toHaveBeenCalled());

    const form = save.mock.calls[0]![1];

    expect(form.get("id")).toBeNull();
    expect(form.get("role")).toBe("Volunteer Developer");
    await waitFor(() => expect(screen.getByRole("button", { name: "Add a role" })).toBeInTheDocument());
  });

  it("keeps the form open with what the Candidate typed, and names the field, when the correction is refused", async () => {
    renderCorrections({ save: refusedOn({ role: "Name the role this experience was for." }) });
    correctFirst();
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Contoso" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name the role this experience was for.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Correcting Senior Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByLabelText("Company")).toHaveValue("Contoso");
  });

  it("puts a refused month beside the field it was typed in", async () => {
    renderCorrections({ save: refusedOn({ "period.end": "The month it ended comes before the month it started." }) });
    correctFirst();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("The month it ended comes before the month it started.")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("From")).not.toHaveAttribute("aria-invalid");
  });

  it("removes a role and says so when it could not be removed", async () => {
    const remove = vi.fn((): Promise<CorrectionResult> => Promise.resolve({ ok: false, message: "We couldn't save your correction. Try again in a moment." }));
    const { remove: called } = renderCorrections({ remove });

    fireEvent.click(screen.getByRole("button", { name: "Remove Freelance Developer" }));

    await waitFor(() => expect(called).toHaveBeenCalledWith(entries[1]!.id));
    expect(await screen.findByText("We couldn't save your correction. Try again in a moment.")).toBeInTheDocument();
  });

  it("clears a failed removal once the Candidate opens a correction", async () => {
    const remove = vi.fn((): Promise<CorrectionResult> => Promise.resolve({ ok: false, message: "We couldn't save your correction. Try again in a moment." }));

    renderCorrections({ remove });
    fireEvent.click(screen.getByRole("button", { name: "Remove Freelance Developer" }));
    await screen.findByText("We couldn't save your correction. Try again in a moment.");
    await waitFor(() => expect(screen.getByRole("button", { name: CORRECT_FIRST })).toBeEnabled());

    correctFirst();

    expect(screen.queryByText("We couldn't save your correction. Try again in a moment.")).not.toBeInTheDocument();
  });

  it("offers no correction of any role while one is being removed", async () => {
    let finish: (result: CorrectionResult) => void = () => undefined;
    const remove = vi.fn(() => new Promise<CorrectionResult>((resolve) => (finish = resolve)));

    renderCorrections({ remove });
    fireEvent.click(screen.getByRole("button", { name: "Remove Freelance Developer" }));

    await waitFor(() => expect(screen.getByRole("button", { name: CORRECT_FIRST })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Add a role" })).toBeDisabled();

    finish({ ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: CORRECT_FIRST })).toBeEnabled());
  });

  it("moves the focus into the form it opens, and back to the role's button when it closes", () => {
    renderCorrections();
    correctFirst();

    expect(screen.getByLabelText("Role")).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: CORRECT_FIRST })).toHaveFocus();
  });

  it("hands the focus back to Add a role once the new role is saved", async () => {
    renderCorrections();
    fireEvent.click(screen.getByRole("button", { name: "Add a role" }));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Volunteer Developer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Add a role" })).toHaveFocus());
  });
});
