import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmailForm } from "./email-form";

const signIn = {
  step: { eyebrow: "Welcome back" },
  copy: {
    title: "Sign in to keep going",
    lead: "Enter the email you signed up with and we'll get you straight back in.",
    submitLabel: "Send my code",
  },
  alternative: { presentation: "button", prompt: "New here?", label: "Create an account", href: "/sign-up" },
} as const;

function submit(value: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Send my code" }));
}

describe("EmailForm", () => {
  it("renders the sign in copy with the divider and the secondary button", () => {
    render(<EmailForm {...signIn} onSubmit={vi.fn()} />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sign in to keep going");
    expect(screen.getByRole("separator", { name: "New here?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("renders the sign up variant with the progress bar and the footer line", () => {
    render(
      <EmailForm
        {...signIn}
        step={{ eyebrow: "Step 1 of 3", progress: { steps: 3, completed: 1 } }}
        copy={{ ...signIn.copy, title: "Let's get you hired" }}
        alternative={{ presentation: "line", prompt: "Already have an account?", label: "Sign in", href: "/sign-in" }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("progressbar", { name: "Step 1 of 3" })).toBeInTheDocument();
    expect(screen.getByText(/Already have an account\?/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("catches an invalid email with the shared schema before submitting", () => {
    const onSubmit = vi.fn();

    render(<EmailForm {...signIn} onSubmit={onSubmit} />);
    submit("ada-at-example.com");

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address");
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the normalised email and clears the field error", () => {
    const onSubmit = vi.fn();

    render(<EmailForm {...signIn} onSubmit={onSubmit} />);
    submit("ada-at-example.com");
    submit("  Ada@Example.COM ");

    expect(onSubmit).toHaveBeenCalledWith("ada@example.com");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the message from the action under the field and disables the button while pending", () => {
    render(<EmailForm {...signIn} onSubmit={vi.fn()} message="We could not send your code. Try again in a moment." pending />);

    expect(screen.getByRole("alert")).toHaveTextContent("We could not send your code");
    expect(screen.getByRole("button", { name: "Send my code" })).toBeDisabled();
  });

  it("keeps the email a Candidate typed before changing it", () => {
    render(<EmailForm {...signIn} defaultEmail="ada@example.com" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Email address")).toHaveValue("ada@example.com");
  });
});
