import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { OneTimeCodeFormInput, OneTimeCodeFormState } from "./actions";
import { OneTimeCodeForm } from "./one-time-code-form";

const alternative = { prompt: "New here?", href: "/sign-up", label: "Create an account" };
const email = "ada@example.com";

function renderForm(answer: (input: OneTimeCodeFormInput) => OneTimeCodeFormState = () => ({ step: "email" })) {
  const action = vi.fn<(previous: OneTimeCodeFormState, input: OneTimeCodeFormInput) => Promise<OneTimeCodeFormState>>(
    (_previous, input) => Promise.resolve(answer(input)),
  );

  render(<OneTimeCodeForm title="Sign in to keep going" lead="Enter your email." action={action} alternative={alternative} />);

  return { action };
}

function sendCode(value: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Send my code" }));
}

const codeStep = (input: OneTimeCodeFormInput): OneTimeCodeFormState =>
  input.kind === "send" ? { step: "code", email: input.request.email } : { step: "email" };

describe("OneTimeCodeForm", () => {
  it("shows the shared schema message inline and does not call the action", async () => {
    const { action } = renderForm();

    sendCode("ada-at-example.com");

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("sends the normalised email and moves to the code step", async () => {
    const { action } = renderForm(codeStep);

    sendCode("  Ada@Example.COM ");

    expect(await screen.findByRole("heading", { name: "Check your inbox" })).toBeInTheDocument();
    expect(action).toHaveBeenCalledWith(expect.anything(), { kind: "send", request: { email } });
    expect(screen.getByText(email)).toBeInTheDocument();
  });

  it("shows the action message when the code could not be sent", async () => {
    renderForm(() => ({ step: "email", message: "We could not send your code. Try again in a moment." }));

    sendCode(email);

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send your code");
  });

  it("validates the code before verifying and then submits it with the email", async () => {
    const { action } = renderForm(codeStep);

    sendCode(email);
    await screen.findByLabelText("Verification code");

    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

    expect(await screen.findByText("Enter all 6 digits of your code")).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

    await vi.waitFor(() =>
      expect(action).toHaveBeenLastCalledWith(expect.anything(), { kind: "verify", request: { email, code: "123456" } }),
    );
  });

  it("shows the rejection message for a wrong code", async () => {
    renderForm((input) =>
      input.kind === "verify"
        ? { step: "code", email, message: "That code is not valid or has expired. Request a new one." }
        : codeStep(input),
    );

    sendCode(email);
    fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That code is not valid or has expired");
  });

  it("goes back to the email step on Change email", async () => {
    renderForm(codeStep);

    sendCode(email);
    fireEvent.click(await screen.findByRole("button", { name: "Change email" }));

    expect(await screen.findByLabelText("Email address")).toBeInTheDocument();
  });

  it("links to the alternative flow", () => {
    renderForm();

    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up");
  });
});
