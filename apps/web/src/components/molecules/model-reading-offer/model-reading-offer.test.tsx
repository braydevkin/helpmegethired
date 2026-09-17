import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ActionFailure } from "../../../lib/with-session";
import { ModelReadingOffer } from "./model-reading-offer";

const offer = { name: "Read my résumé again with your AI" };

describe("ModelReadingOffer", () => {
  it("offers the reading without starting it", () => {
    const start = vi.fn();

    render(<ModelReadingOffer fileName="ada-lovelace.pdf" start={start} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Your AI can read your résumé again");
    expect(screen.getByText(/We kept the text of ada-lovelace\.pdf/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", offer));

    expect(start).not.toHaveBeenCalled();
  });

  it("says plainly what is replaced and what it costs before anything starts", () => {
    render(<ModelReadingOffer fileName="ada-lovelace.pdf" start={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", offer));

    const consequences = screen.getAllByRole("listitem").map((item) => item.textContent);

    expect(screen.getByRole("heading", { level: 2, name: "Rebuild your profile with your AI?" })).toHaveFocus();
    expect(consequences).toEqual([
      "Your AI rebuilds this profile from the text of ada-lovelace.pdf.",
      "The corrections you made here are replaced, and you confirm the new profile again.",
      "A finished analysis of your profile is replaced too.",
      "It runs on your API key, so your provider counts the tokens it uses.",
    ]);
  });

  it("names the résumé in general words when the file name is not known", () => {
    render(<ModelReadingOffer fileName={null} start={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", offer));

    expect(screen.getByText("Your AI rebuilds this profile from the text of your résumé.")).toBeInTheDocument();
  });

  it("goes back to the offer when the Candidate keeps the profile", () => {
    const start = vi.fn();

    render(<ModelReadingOffer fileName="ada-lovelace.pdf" start={start} />);
    fireEvent.click(screen.getByRole("button", offer));
    fireEvent.click(screen.getByRole("button", { name: "Keep my profile" }));

    expect(screen.getByRole("button", offer)).toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
  });

  it("starts the reading once confirmed, and holds both buttons while it starts", async () => {
    let answer: (failure: ActionFailure) => void = () => undefined;
    const start = vi.fn(() => new Promise<ActionFailure>((resolve) => (answer = resolve)));

    render(<ModelReadingOffer fileName="ada-lovelace.pdf" start={start} />);
    fireEvent.click(screen.getByRole("button", offer));
    fireEvent.click(screen.getByRole("button", { name: "Read it again" }));

    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Read it again" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Keep my profile" })).toBeDisabled();

    answer({ ok: false, message: "We couldn't start reading your résumé again. Try again in a moment." });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("shows why it could not start and keeps the confirmation open", async () => {
    const start = vi.fn().mockResolvedValue({ ok: false, message: "Your résumé is already being read. Wait for it to finish, then try again." });

    render(<ModelReadingOffer fileName="ada-lovelace.pdf" start={start} />);
    fireEvent.click(screen.getByRole("button", offer));
    fireEvent.click(screen.getByRole("button", { name: "Read it again" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your résumé is already being read");
    expect(screen.getByRole("button", { name: "Read it again" })).toBeEnabled();
  });

  it("forgets an earlier refusal once the Candidate keeps the profile and asks again", async () => {
    const start = vi.fn().mockResolvedValue({ ok: false, message: "Your résumé is already being read. Wait for it to finish, then try again." });

    render(<ModelReadingOffer fileName="ada-lovelace.pdf" start={start} />);
    fireEvent.click(screen.getByRole("button", offer));
    fireEvent.click(screen.getByRole("button", { name: "Read it again" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Keep my profile" }));
    fireEvent.click(screen.getByRole("button", offer));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
