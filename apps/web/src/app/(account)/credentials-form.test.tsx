import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CredentialsFormState } from "./actions";
import { CredentialsForm } from "./credentials-form";

const alternative = { prompt: "New here?", href: "/sign-up", label: "Sign up" };

function renderForm(result: CredentialsFormState = { ok: true }) {
  const action = vi.fn<(previous: CredentialsFormState) => Promise<CredentialsFormState>>(() =>
    Promise.resolve(result),
  );

  render(
    <CredentialsForm
      title="Sign in"
      submitLabel="Sign in"
      passwordAutoComplete="current-password"
      action={action}
      alternative={alternative}
    />,
  );

  return { action };
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("CredentialsForm", () => {
  it("shows the shared schema messages inline and does not call the action", async () => {
    const { action } = renderForm();

    fillAndSubmit("ada-at-example.com", "short");

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Password must have at least 8 characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
    expect(action).not.toHaveBeenCalled();
  });

  it("calls the action with the normalised credentials when the schema accepts them", async () => {
    const { action } = renderForm();

    fillAndSubmit("  Ada@Example.COM ", "correct horse battery");

    await waitFor(() =>
      expect(action).toHaveBeenCalledWith(
        { ok: true },
        { email: "ada@example.com", password: "correct horse battery" },
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the message the action answers with", async () => {
    renderForm({ ok: false, message: "Invalid email or password" });

    fillAndSubmit("ada@example.com", "wrong password!");

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
  });

  it("links to the alternative page", () => {
    renderForm();

    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
  });
});
