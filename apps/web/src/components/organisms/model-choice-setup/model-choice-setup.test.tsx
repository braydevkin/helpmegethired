import type { AccountModelChoice, ModelCatalogueEntry } from "@helpmegethired/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelChoiceSetup, type ModelChoiceResult } from "./model-choice-setup";

const entry: ModelCatalogueEntry = {
  provider: "anthropic",
  providerName: "Anthropic",
  modelId: "claude-sonnet-5",
  description: "Claude Sonnet 5, called by the identifier claude-sonnet-5 on every request.",
};
const stored: AccountModelChoice = { provider: "anthropic", modelId: "claude-sonnet-5", keyStored: true };
const revoked: AccountModelChoice = { ...stored, keyStored: false };
const links = { keyConsole: "https://console.provider.test/keys", terms: "https://provider.test/terms" };
const KEY = "sk-ant-api03-a-key-nobody-should-see-again";
const NO_FIGURES = /[$€£]|\bcosts?\b|\bprice|\bspeed|\bquality|\bdepth|~\s*\d|\d+\s*(?:s|secs?|seconds|mins?|minutes)\b/i;

function renderSetup(initialChoice: AccountModelChoice | null = null) {
  const save = vi.fn<(key: string) => Promise<ModelChoiceResult>>();
  const revoke = vi.fn<() => Promise<ModelChoiceResult>>();

  render(<ModelChoiceSetup entry={entry} initialChoice={initialChoice} links={links} analysisHref="/journey/analysis" save={save} revoke={revoke} />);

  return { save, revoke };
}

const keyField = () => screen.getByLabelText("Anthropic API key");

const submitKey = (key: string) => {
  fireEvent.change(keyField(), { target: { value: key } });
  fireEvent.click(screen.getByRole("button", { name: "Save key" }));
};

const pageText = () => document.body.textContent ?? "";

describe("ModelChoiceSetup", () => {
  it("keeps the primary action disabled, with its reason, until a key is stored", () => {
    renderSetup();

    const start = screen.getByRole("button", { name: "Continue to the analysis" });

    expect(start).toBeDisabled();
    expect(start).toHaveAccessibleDescription("Add your API key to continue.");
    expect(screen.getByText("Not added yet")).toBeInTheDocument();
  });

  it("saves the key, then shows it only as stored and offers the analysis", async () => {
    const { save } = renderSetup();

    save.mockResolvedValue({ ok: true, choice: stored });
    submitKey(KEY);

    expect(await screen.findByText("Your Anthropic key is stored")).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith(KEY);
    expect(screen.queryByLabelText("Anthropic API key")).not.toBeInTheDocument();
    expect(pageText()).not.toContain(KEY);
    expect(screen.getByText("Stored · billed by Anthropic")).toBeInTheDocument();

    const start = screen.getByRole("link", { name: "Continue to the analysis" });

    expect(start).toHaveAttribute("href", "/journey/analysis");
    expect(start).toHaveAccessibleDescription("The analysis runs on its own, so you can close the tab once it starts.");
  });

  it("shows a refusal under the emptied field and lets the Candidate correct the key in place", async () => {
    const { save } = renderSetup();

    save.mockResolvedValueOnce({ ok: false, message: "Anthropic doesn't accept this key." }).mockResolvedValueOnce({ ok: true, choice: stored });
    submitKey(KEY);

    expect(await screen.findByRole("alert")).toHaveTextContent("Anthropic doesn't accept this key.");
    expect(keyField()).toHaveValue("");
    expect(keyField()).toHaveAttribute("aria-invalid", "true");
    expect(pageText()).not.toContain(KEY);

    submitKey("sk-ant-api03-the-corrected-key-000");

    expect(await screen.findByText("Your Anthropic key is stored")).toBeInTheDocument();
    expect(save).toHaveBeenLastCalledWith("sk-ant-api03-the-corrected-key-000");
  });

  it("shows a stored key as stored, never as characters, and replaces it through the same form", async () => {
    const { save } = renderSetup(stored);

    expect(screen.getByText("Your Anthropic key is stored")).toBeInTheDocument();
    expect(screen.queryByLabelText("Anthropic API key")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replace key" }));
    save.mockResolvedValue({ ok: true, choice: stored });
    submitKey(KEY);

    await vi.waitFor(() => expect(screen.queryByLabelText("Anthropic API key")).not.toBeInTheDocument());
    expect(pageText()).not.toContain(KEY);
  });

  it("revokes a stored key after saying what that stops", async () => {
    const { revoke } = renderSetup(stored);

    revoke.mockResolvedValue({ ok: true, choice: revoked });

    const revokeButton = screen.getByRole("button", { name: "Revoke key" });

    expect(revokeButton).toHaveAccessibleDescription(/No analysis can run until you add a key again/);

    fireEvent.click(revokeButton);

    expect(await screen.findByText("Not added yet")).toBeInTheDocument();
    expect(keyField()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to the analysis" })).toBeDisabled();
  });

  it("keeps the key stored and says so when it could not be revoked", async () => {
    const { revoke } = renderSetup(stored);

    revoke.mockResolvedValue({ ok: false, message: "We couldn't revoke your key. Try again in a moment." });
    fireEvent.click(screen.getByRole("button", { name: "Revoke key" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't revoke your key.");
    expect(screen.getByText("Stored · billed by Anthropic")).toBeInTheDocument();
  });

  it("says who bills the Candidate and links to the provider's key console and terms", () => {
    renderSetup();

    expect(screen.getByText(/pay Anthropic directly/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anthropic's terms" })).toHaveAttribute("href", links.terms);
    expect(screen.getByRole("link", { name: "Where do I find this?" })).toHaveAttribute("href", links.keyConsole);
  });

  it.each([
    ["without a key", null],
    ["with a stored key", stored],
  ])("shows the pinned model and no price, cost, speed or quality figure %s", (_label, choice) => {
    renderSetup(choice);

    expect(screen.getByText("claude-sonnet-5 · pinned")).toBeInTheDocument();
    expect(pageText()).not.toMatch(NO_FIGURES);
  });

  it("puts the key field, its submit and then the summary's action in keyboard order", () => {
    renderSetup();

    const controls = Array.from(document.querySelectorAll("a[href], button, input"));
    const save = screen.getByRole("button", { name: "Save key" });

    expect(controls.indexOf(keyField())).toBeLessThan(controls.indexOf(save));
    expect(controls.indexOf(save)).toBeLessThan(controls.indexOf(screen.getByRole("button", { name: "Continue to the analysis" })));
    expect(keyField().closest("form")).toContainElement(save);
    expect(save).toHaveAttribute("type", "submit");
    expect(document.querySelector("[tabindex]:not([tabindex='0']):not([tabindex='-1'])")).toBeNull();
  });
});
