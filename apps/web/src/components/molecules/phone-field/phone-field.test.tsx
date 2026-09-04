import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhoneField } from "./phone-field";

const dialCode = {
  name: "phoneCountryCode",
  options: [
    { value: "+351", label: "PT +351" },
    { value: "+55", label: "BR +55" },
  ],
  defaultValue: "+351",
};
const number = { name: "phoneNumber" };

describe("PhoneField", () => {
  it("pairs a dial code select with the national number input", () => {
    render(<PhoneField id="phone" dialCode={dialCode} number={number} />);

    expect(screen.getByLabelText("Country code")).toHaveValue("+351");
    expect(screen.getByLabelText("Country code")).toHaveAttribute("name", "phoneCountryCode");

    const nationalNumber = screen.getByLabelText("Phone");

    expect(nationalNumber).toHaveAttribute("type", "tel");
    expect(nationalNumber).toHaveAttribute("name", "phoneNumber");
    expect(nationalNumber).toHaveAttribute("autocomplete", "tel-national");
  });

  it("keeps a previously typed number", () => {
    render(<PhoneField id="phone" dialCode={dialCode} number={{ ...number, defaultValue: "912345678" }} />);

    expect(screen.getByLabelText("Phone")).toHaveValue("912345678");
  });

  it("shows the error on both controls", () => {
    render(
      <PhoneField id="phone" dialCode={dialCode} number={number} error="Enter a phone number we can reach you on." />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a phone number we can reach you on.");
    expect(screen.getByLabelText("Phone")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Country code")).toHaveAttribute("aria-invalid", "true");
  });
});
