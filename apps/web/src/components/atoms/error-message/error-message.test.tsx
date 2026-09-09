import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorMessage } from "./error-message";

describe("ErrorMessage", () => {
  it("announces the message as an alert", () => {
    render(<ErrorMessage>Enter a valid email address.</ErrorMessage>);

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
  });
});
