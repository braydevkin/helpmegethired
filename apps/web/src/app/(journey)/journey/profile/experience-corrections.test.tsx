import type { Experience } from "@helpmegethired/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CorrectionAction, CorrectionResult } from "../../../../lib/profile/correction-form";
import type { ExperienceEntry } from "../../../../components/organisms/experience-timeline/experience-timeline";
import { ExperienceCorrections } from "./experience-corrections";

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

const renderCorrections = (
  { save = vi.fn(saved), remove = vi.fn(removed), editable = true } = {},
) => ({
  save,
  remove,
  ...render(<ExperienceCorrections entries={entries} experiences={experiences} meta="2 roles" editable={editable} save={save} remove={remove} />),
});

const correctFirst = () => fireEvent.click(screen.getAllByRole("button", { name: "Correct this role" })[0]!);

describe("ExperienceCorrections", () => {
  it("marks the roles the Candidate has corrected", () => {
    renderCorrections();

    expect(screen.getByText("Corrected by you")).toBeInTheDocument();
  });

  it("offers nothing to correct once the Profile is confirmed", () => {
    renderCorrections({ editable: false });

    expect(screen.queryByRole("button", { name: "Correct this role" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a role" })).not.toBeInTheDocument();
  });

  it("opens one role at a time, with the months the Experience carries and not the ones on screen", () => {
    renderCorrections();
    correctFirst();

    expect(screen.getByRole("group", { name: "Correcting Senior Backend Engineer" })).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2022-03");
    expect(screen.getByLabelText("To")).toHaveValue("");
    expect(screen.getByLabelText("Skills")).toHaveValue("Node.js, NestJS");
    expect(screen.queryByRole("button", { name: "Correct this role" })).not.toBeInTheDocument();
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

  it("keeps the form open and names the field when the correction is refused", async () => {
    const save = vi.fn<CorrectionAction>(() =>
      Promise.resolve({ ok: false, message: "We couldn't save your correction.", issues: { role: "Name the role this experience was for." } }),
    );

    renderCorrections({ save });
    correctFirst();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name the role this experience was for.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Correcting Senior Backend Engineer" })).toBeInTheDocument();
  });

  it("removes a role and says so when it could not be removed", async () => {
    const remove = vi.fn((): Promise<CorrectionResult> => Promise.resolve({ ok: false, message: "We couldn't save your correction. Try again in a moment." }));
    const { remove: called } = renderCorrections({ remove });

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]!);

    await waitFor(() => expect(called).toHaveBeenCalledWith(entries[1]!.id));
    expect(await screen.findByText("We couldn't save your correction. Try again in a moment.")).toBeInTheDocument();
  });

  it("is correctable with the keyboard alone", async () => {
    const { save } = renderCorrections();
    const open = screen.getAllByRole("button", { name: "Correct this role" })[0]!;

    open.focus();
    fireEvent.click(open);

    const role = screen.getByLabelText("Role");

    role.focus();
    expect(role).toHaveFocus();
    fireEvent.change(role, { target: { value: "Staff Backend Engineer" } });

    const form = within(screen.getByRole("group", { name: "Correcting Senior Backend Engineer" }).closest("form")!);

    fireEvent.click(form.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(save).toHaveBeenCalled());
  });
});
