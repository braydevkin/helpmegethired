import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TextInput } from "../../atoms/text-input/text-input";
import { Field } from "./field";

describe("Field", () => {
  it("labels the control and marks an optional field", () => {
    render(
      <Field id="address" label="Address" optional hint="Helps us surface roles near you and flag relocation offers.">
        {(control) => <TextInput {...control} placeholder="City, country" />}
      </Field>,
    );

    const input = screen.getByLabelText("Address");

    expect(input).toHaveAttribute("id", "address");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Helps us surface roles near you and flag relocation offers.");
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("renders the error as an alert and links it to the control", () => {
    render(
      <Field id="email" label="Email address" error="Enter a valid email address.">
        {(control) => <TextInput {...control} type="email" />}
      </Field>,
    );

    const input = screen.getByLabelText("Email address");

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email address.");
  });

  it("renders no alert without an error", () => {
    render(
      <Field id="name" label="Name">
        {(control) => <TextInput {...control} />}
      </Field>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
