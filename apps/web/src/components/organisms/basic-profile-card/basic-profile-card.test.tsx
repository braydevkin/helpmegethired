import type { BasicProfile } from "@helpmegethired/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CorrectionAction } from "../../../lib/profile/correction-form";
import { BasicProfileCard } from "./basic-profile-card";

const basicProfile: BasicProfile = {
  headline: "Backend engineer",
  summary: "Ten years building distributed systems.",
  linkedinUrl: "https://www.linkedin.com/in/ada",
  githubUrl: null,
};

const saved: CorrectionAction = () => Promise.resolve({ ok: true });

const renderCard = (save: CorrectionAction, { corrected = false, editable = true } = {}) =>
  render(<BasicProfileCard basicProfile={basicProfile} corrected={corrected} editable={editable} save={save} />);

const correct = () => fireEvent.click(screen.getByRole("button", { name: "Correct this" }));

describe("BasicProfileCard", () => {
  it("shows what the résumé said, and says where it said nothing", () => {
    renderCard(saved);

    expect(screen.getByText("Backend engineer")).toBeInTheDocument();
    expect(screen.getByText("https://www.linkedin.com/in/ada")).toBeInTheDocument();
    expect(screen.getByText("Not found in your résumé")).toBeInTheDocument();
  });

  it("marks a Basic Profile the Candidate has corrected", () => {
    renderCard(saved, { corrected: true });

    expect(screen.getByText("Corrected by you")).toBeInTheDocument();
  });

  it("offers no correction once the Profile is confirmed", () => {
    renderCard(saved, { editable: false });

    expect(screen.queryByRole("button", { name: "Correct this" })).not.toBeInTheDocument();
  });

  it("sends what the Candidate typed and closes the form", async () => {
    const save = vi.fn(saved);

    renderCard(save);
    correct();
    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "Distributed systems engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(save).toHaveBeenCalled());

    const form = save.mock.calls[0]![1];

    expect(form.get("headline")).toBe("Distributed systems engineer");
    expect(form.get("githubUrl")).toBe("");
    await waitFor(() => expect(screen.getByRole("button", { name: "Correct this" })).toBeInTheDocument());
  });

  it("keeps the form open with the message beside the field it belongs to", async () => {
    const refused: CorrectionAction = () =>
      Promise.resolve({ ok: false, message: "We couldn't save your correction.", issues: { linkedinUrl: "Give the full address, starting with https://." } });

    renderCard(refused);
    correct();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Give the full address, starting with https://.")).toBeInTheDocument();
    expect(screen.getByLabelText("LinkedIn")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("leaves the Profile as it was when the correction is cancelled", () => {
    const save = vi.fn(saved);

    renderCard(save);
    correct();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText("Backend engineer")).toBeInTheDocument();
  });
});
