import type { BasicProfile } from "@helpmegethired/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
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

const refused: CorrectionAction = () =>
  Promise.resolve({ ok: false, message: "Some fields need a change before this can be saved.", issues: { linkedinUrl: "Give the full address, starting with https://." } });

function CorrectableCard({ save, profile = basicProfile }: { save: CorrectionAction; profile?: BasicProfile }) {
  const [editing, setEditing] = useState(false);

  return <BasicProfileCard basicProfile={profile} corrected={false} editing={editing} save={save} onClose={() => setEditing(false)} onEdit={() => setEditing(true)} />;
}

const correct = () => fireEvent.click(screen.getByRole("button", { name: "Correct this" }));

describe("BasicProfileCard", () => {
  it("shows the summary, leaving the headline and the addresses to the header and the sidebar", () => {
    render(<CorrectableCard save={saved} />);

    expect(screen.getByText("Ten years building distributed systems.")).toBeInTheDocument();
    expect(screen.queryByText("Backend engineer")).not.toBeInTheDocument();
    expect(screen.queryByText("https://www.linkedin.com/in/ada")).not.toBeInTheDocument();
  });

  it("says where the PDF gave no summary", () => {
    render(<CorrectableCard save={saved} profile={{ ...basicProfile, summary: null }} />);

    expect(screen.getByText("Not found in your PDF")).toBeInTheDocument();
  });

  it("marks a Basic Profile the Candidate has corrected", () => {
    render(<BasicProfileCard basicProfile={basicProfile} corrected editing={false} save={saved} onClose={vi.fn()} />);

    expect(screen.getByText("Corrected by you")).toBeInTheDocument();
  });

  it("offers no correction when none is offered to it", () => {
    render(<BasicProfileCard basicProfile={basicProfile} corrected={false} editing={false} save={saved} onClose={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Correct this" })).not.toBeInTheDocument();
  });

  it("opens on the headline, sends what the Candidate typed, and closes", async () => {
    const save = vi.fn(saved);

    render(<CorrectableCard save={save} />);
    correct();

    expect(screen.getByLabelText("Headline")).toHaveFocus();

    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "Distributed systems engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(save).toHaveBeenCalled());

    const form = save.mock.calls[0]![1];

    expect(form.get("headline")).toBe("Distributed systems engineer");
    expect(form.get("githubUrl")).toBe("");
    await waitFor(() => expect(screen.getByRole("button", { name: "Correct this" })).toBeInTheDocument());
  });

  it("keeps what the Candidate typed when the correction is refused, with the message beside its field", async () => {
    render(<CorrectableCard save={refused} />);
    correct();
    fireEvent.change(screen.getByLabelText("LinkedIn"), { target: { value: "linkedin.com/in/ada" } });
    fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "Distributed systems engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Give the full address, starting with https://.")).toBeInTheDocument();
    expect(screen.getByLabelText("LinkedIn")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("LinkedIn")).toHaveValue("linkedin.com/in/ada");
    expect(screen.getByLabelText("Headline")).toHaveValue("Distributed systems engineer");
  });

  it("opens again without the refusal of the attempt that was cancelled", async () => {
    render(<CorrectableCard save={refused} />);
    correct();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Give the full address, starting with https://.");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    correct();

    expect(screen.queryByText("Give the full address, starting with https://.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("LinkedIn")).not.toHaveAttribute("aria-invalid");
  });

  it("leaves the Profile as it was when the correction is cancelled", () => {
    const save = vi.fn(saved);

    render(<CorrectableCard save={save} />);
    correct();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText("Ten years building distributed systems.")).toBeInTheDocument();
  });
});
