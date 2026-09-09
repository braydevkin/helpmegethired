import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CodeForm, type CodeFormProps } from "./code-form";

const email = "ada@example.com";
const digitBoxes = () => screen.getAllByLabelText(/^Verification digit \d$/);

function codeForm(handlers: Pick<CodeFormProps, "onVerify" | "onChangeEmail" | "onResend">, props: Partial<CodeFormProps>) {
  return <CodeForm delivery={{ email, sentAt: Date.now() }} step={{ eyebrow: "Welcome back" }} {...handlers} {...props} />;
}

function renderCodeForm(props: Partial<CodeFormProps> = {}) {
  const handlers = { onVerify: vi.fn(), onChangeEmail: vi.fn(), onResend: vi.fn() };
  const { rerender } = render(codeForm(handlers, props));

  return { ...handlers, rerender: (next: Partial<CodeFormProps>) => rerender(codeForm(handlers, { ...props, ...next })) };
}

function typeCode(code: string) {
  fireEvent.paste(digitBoxes()[0]!, { clipboardData: { getData: () => code } });
}

describe("CodeForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the email the code went to and shows the countdown", () => {
    renderCodeForm();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Check your inbox");
    expect(screen.getByText(email).tagName).toBe("STRONG");
    expect(screen.getByText(/It expires in 10 minutes/)).toBeInTheDocument();
    expect(screen.getByText("Resend in 1:00")).toBeInTheDocument();
    expect(digitBoxes()[0]).toHaveFocus();
  });

  it("shows the progress bar only when asked", () => {
    renderCodeForm({ step: { eyebrow: "Step 2 of 3", progress: { steps: 3, completed: 2 } } });

    expect(screen.getByRole("progressbar", { name: "Step 2 of 3" })).toBeInTheDocument();
  });

  it("requires all six digits before verifying", () => {
    const { onVerify } = renderCodeForm();

    typeCode("12345");
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Enter all 6 digits of your code");
    expect(onVerify).not.toHaveBeenCalled();
  });

  it("verifies a complete code", () => {
    const { onVerify } = renderCodeForm();

    typeCode("482913");
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

    expect(onVerify).toHaveBeenCalledWith("482913");
  });

  it("shows a rejected code inline", () => {
    renderCodeForm({ message: "That code is not valid or has expired. Request a new one." });

    expect(screen.getByRole("alert")).toHaveTextContent("That code is not valid or has expired");
    expect(digitBoxes()[0]).toHaveAttribute("aria-invalid", "true");
  });

  it("clears the digits when a code is rejected and when a new code is sent", () => {
    const { rerender } = renderCodeForm();

    typeCode("482913");
    expect(digitBoxes()[0]).toHaveValue("4");

    rerender({ message: "That code is not valid or has expired. Request a new one." });
    expect(digitBoxes()[0]).toHaveValue("");

    typeCode("482914");
    rerender({ message: "That code is not valid or has expired. Request a new one.", delivery: { email, sentAt: Date.now() + 1 } });
    expect(digitBoxes()[0]).toHaveValue("");
  });

  it("goes back to the email step", () => {
    const { onChangeEmail } = renderCodeForm();

    fireEvent.click(screen.getByRole("button", { name: "Change email" }));

    expect(onChangeEmail).toHaveBeenCalledTimes(1);
  });

  it("offers to resend only after the countdown", () => {
    const { onResend } = renderCodeForm();

    expect(screen.queryByRole("button", { name: "Resend code" })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));

    expect(onResend).toHaveBeenCalledTimes(1);
  });

  it("disables everything while pending", () => {
    renderCodeForm({ pending: true });

    expect(screen.getByRole("button", { name: "Verify and continue" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Change email" })).toBeDisabled();
    expect(digitBoxes()[0]).toHaveFocus();
  });
});
