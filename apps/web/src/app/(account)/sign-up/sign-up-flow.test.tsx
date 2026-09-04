import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveAccountInformationAction, sendCodeAction, verifyCodeAction } from "../actions";
import { SignUpFlow } from "./sign-up-flow";

vi.mock("../actions", () => ({
  sendCodeAction: vi.fn(),
  verifyCodeAction: vi.fn(),
  saveAccountInformationAction: vi.fn(),
}));

const email = "ada@example.com";
const dialCodes = [{ value: "+351", label: "PT +351" }];
const sendCode = vi.mocked(sendCodeAction);
const verifyCode = vi.mocked(verifyCodeAction);
const saveInformation = vi.mocked(saveAccountInformationAction);

function renderFlow(start: Parameters<typeof SignUpFlow>[0]["start"] = { step: "email" }) {
  render(<SignUpFlow start={start} dialCodes={dialCodes} defaultDialCode="+351" />);
}

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function submitCode(code: string) {
  fireEvent.paste(screen.getAllByLabelText(/^Verification digit \d$/)[0]!, { clipboardData: { getData: () => code } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
}

async function settled(name: string) {
  await vi.waitFor(() => expect(screen.getByRole("button", { name })).toBeEnabled());
}

function submitIdentity() {
  fill("Name", "Ada");
  fill("Last name", "Lovelace");
  fill("Phone", "912345678");
  fireEvent.click(screen.getByRole("button", { name: "Create my account" }));
}

describe("SignUpFlow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts at step 1 with the sign up copy and the sign in link", () => {
    renderFlow();

    expect(screen.getByRole("progressbar", { name: "Step 1 of 3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Let's get you hired");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  });

  it("walks through the three steps to the done screen", async () => {
    sendCode.mockResolvedValue({ ok: true });
    verifyCode.mockResolvedValue({ ok: true });
    saveInformation.mockResolvedValue({ ok: true });
    renderFlow();

    fill("Email address", email);
    fireEvent.click(screen.getByRole("button", { name: "Send my code" }));

    expect(await screen.findByRole("progressbar", { name: "Step 2 of 3" })).toBeInTheDocument();
    expect(sendCode).toHaveBeenCalledWith({ email });
    await settled("Verify and continue");

    submitCode("482913");

    expect(await screen.findByRole("heading", { name: "Tell us who you are" })).toBeInTheDocument();
    expect(verifyCode).toHaveBeenCalledWith({ email, code: "482913" });
    expect(screen.getByLabelText("Email")).toHaveValue(email);
    await settled("Create my account");

    submitIdentity();

    expect(await screen.findByRole("heading", { name: "You're in, Ada" })).toBeInTheDocument();
    expect(saveInformation).toHaveBeenCalledWith({
      name: "Ada",
      lastName: "Lovelace",
      phone: { countryCode: "+351", number: "912345678" },
      address: null,
    });
    expect(screen.getByRole("link", { name: "Go to my dashboard" })).toHaveAttribute("href", "/journey");
  });

  it("resumes at the code step with the pending email", () => {
    renderFlow({ step: "code", email, sentAt: Date.now() });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Check your inbox");
    expect(screen.getByText(email)).toBeInTheDocument();
  });

  it("resumes at the identity step once the Session is open", () => {
    renderFlow({ step: "identity", email });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tell us who you are");
  });

  it("shows a rejected code inline", async () => {
    verifyCode.mockResolvedValue({ ok: false, message: "That code is not valid or has expired. Request a new one." });
    renderFlow({ step: "code", email, sentAt: Date.now() });

    submitCode("000000");

    expect(await screen.findByRole("alert")).toHaveTextContent("That code is not valid or has expired");
  });

  it("shows the message when the information could not be saved", async () => {
    saveInformation.mockResolvedValue({ ok: false, message: "We could not save your details. Check them and try again." });
    renderFlow({ step: "identity", email });

    submitIdentity();

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not save your details");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tell us who you are");
  });

  it("goes back to step 1 keeping the email", async () => {
    renderFlow({ step: "code", email, sentAt: Date.now() });

    fireEvent.click(screen.getByRole("button", { name: "Change email" }));

    expect(await screen.findByLabelText("Email address")).toHaveValue(email);
  });
});
