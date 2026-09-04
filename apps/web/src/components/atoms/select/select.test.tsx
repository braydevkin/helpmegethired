import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Select } from "./select";

describe("Select", () => {
  it("renders the options it is given and the chosen value", () => {
    render(
      <Select aria-label="Country code" defaultValue="+55">
        <option value="+351">PT +351</option>
        <option value="+55">BR +55</option>
      </Select>,
    );

    expect(screen.getByLabelText("Country code")).toHaveValue("+55");
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
});
