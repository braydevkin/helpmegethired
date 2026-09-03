import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PhoneField } from "./phone-field";

const dialCodes = [
  { value: "+351", label: "PT +351" },
  { value: "+55", label: "BR +55" },
];

describe("PhoneField", () => {
  it("pairs a dial code select with the national number input", () => {
    render(
      <PhoneField
        id="phone"
        dialCodes={dialCodes}
        defaultDialCode="+351"
        dialCodeName="phoneCountryCode"
        numberName="phoneNumber"
      />,
    );

    expect(screen.getByLabelText("Country code")).toHaveValue("+351");
    expect(screen.getByLabelText("Country code")).toHaveAttribute("name", "phoneCountryCode");

    const number = screen.getByLabelText("Phone");

    expect(number).toHaveAttribute("type", "tel");
    expect(number).toHaveAttribute("name", "phoneNumber");
    expect(number).toHaveAttribute("autocomplete", "tel-national");
  });

  it("shows the error on both controls", () => {
    render(
      <PhoneField
        id="phone"
        dialCodes={dialCodes}
        defaultDialCode="+351"
        dialCodeName="phoneCountryCode"
        numberName="phoneNumber"
        error="Enter a phone number we can reach you on."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a phone number we can reach you on.");
    expect(screen.getByLabelText("Phone")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Country code")).toHaveAttribute("aria-invalid", "true");
  });
});
