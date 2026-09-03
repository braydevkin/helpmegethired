import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendCodeAction, signInWithCodeAction } from "../actions";
import { SignInFlow } from "./sign-in-flow";

vi.mock("../actions", () => ({
  sendCodeAction: vi.fn(),
  signInWithCodeAction: vi.fn(),
}));

const email = "ada@example.com";
const sendCode = vi.mocked(sendCodeAction);
const signInWithCode = vi.mocked(signInWithCodeAction);

function requestCode(value: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Send my code" }));
}

async function reachCodeStep() {
  sendCode.mockResolvedValue({ ok: true });
  render(<SignInFlow />);
  requestCode(email);
  await screen.findByRole("heading", { name: "Check your inbox" });
  await vi.waitFor(() => expect(screen.getByRole("button", { name: "Change email" })).toBeEnabled());
}

function submitCode(code: string) {
  fireEvent.paste(screen.getAllByLabelText("Verification digit")[0]!, { clipboardData: { getData: () => code } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
}

describe("SignInFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts on the email screen with the sign in copy", () => {
    render(<SignInFlow />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sign in to keep going");
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/sign-up");
  });

  it("sends the code and moves to the code screen", async () => {
    await reachCodeStep();

    expect(sendCode).toHaveBeenCalledWith({ email });
    expect(screen.getByText(email)).toBeInTheDocument();
  });

  it("stays on the email screen with the message when the code could not be sent", async () => {
    sendCode.mockResolvedValue({ ok: false, message: "We could not send your code. Try again in a moment." });
    render(<SignInFlow />);

    requestCode(email);

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send your code");
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("verifies the code with the email it was sent to", async () => {
    signInWithCode.mockResolvedValue({ ok: true });
    await reachCodeStep();

    submitCode("482913");

    await vi.waitFor(() => expect(signInWithCode).toHaveBeenCalledWith({ email, code: "482913" }));
  });

  it("shows a rejected code inline and lets the Candidate try again", async () => {
    signInWithCode.mockResolvedValue({ ok: false, message: "That code is not valid or has expired. Request a new one." });
    await reachCodeStep();

    submitCode("000000");

    expect(await screen.findByRole("alert")).toHaveTextContent("That code is not valid or has expired");
    expect(screen.getAllByLabelText("Verification digit")[0]).toHaveValue("");
  });

  it("goes back to the email screen keeping the email", async () => {
    await reachCodeStep();

    fireEvent.click(screen.getByRole("button", { name: "Change email" }));

    expect(await screen.findByLabelText("Email address")).toHaveValue(email);
  });
});
