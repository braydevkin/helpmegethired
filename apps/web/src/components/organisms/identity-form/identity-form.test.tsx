import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IdentityForm } from "./identity-form";

const dialCodes = [
  { value: "+351", label: "PT +351" },
  { value: "+44", label: "GB +44" },
];

function renderIdentityForm(props: Partial<Parameters<typeof IdentityForm>[0]> = {}) {
  const onSubmit = vi.fn();

  render(
    <IdentityForm email="ada@example.com" dialCodes={dialCodes} defaultDialCode="+351" onSubmit={onSubmit} {...props} />,
  );

  return { onSubmit };
}

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Create my account" }));

describe("IdentityForm", () => {
  it("renders step 3 of 3 with the verified email read-only and the address optional", () => {
    renderIdentityForm();

    expect(screen.getByRole("progressbar", { name: "Step 3 of 3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tell us who you are");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByLabelText("Country code")).toHaveValue("+351");
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(screen.getByText(/Helps us surface roles near you/)).toBeInTheDocument();
    expect(screen.queryByText(/Terms/)).not.toBeInTheDocument();
  });

  it("requires the name, the last name, and a reachable phone number before submitting", () => {
    const { onSubmit } = renderIdentityForm();

    fill("Phone", "12");
    submit();

    const alerts = screen.getAllByRole("alert").map((alert) => alert.textContent);

    expect(alerts).toEqual(["Name is required", "Last name is required", "Enter a phone number we can reach you on"]);
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the parsed information with the dial code and a null address when empty", () => {
    const { onSubmit } = renderIdentityForm();

    fill("Name", " Ada ");
    fill("Last name", "Lovelace");
    fill("Country code", "+44");
    fill("Phone", "7700 900 123");
    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Ada",
      lastName: "Lovelace",
      phone: { countryCode: "+44", number: "7700900123" },
      address: null,
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the address when given", () => {
    const { onSubmit } = renderIdentityForm();

    fill("Name", "Ada");
    fill("Last name", "Lovelace");
    fill("Phone", "912345678");
    fill("Address", "Lisbon, Portugal");
    submit();

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ address: "Lisbon, Portugal" }));
  });

  it("shows the message from the action and disables the button while pending", () => {
    renderIdentityForm({ message: "We could not save your details. Check them and try again.", pending: true });

    expect(screen.getByRole("alert")).toHaveTextContent("We could not save your details");
    expect(screen.getByRole("button", { name: "Create my account" })).toBeDisabled();
  });
});
