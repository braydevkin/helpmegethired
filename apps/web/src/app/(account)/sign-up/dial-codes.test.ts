import { DIAL_CODES } from "@helpmegethired/shared";
import { describe, expect, it } from "vitest";

import { dialCodeOptions } from "./dial-codes";

describe("dialCodeOptions", () => {
  it("lists every shared dial code in order with its country as text", () => {
    expect(dialCodeOptions.map((option) => option.value)).toEqual([...DIAL_CODES]);
    expect(dialCodeOptions[0]).toEqual({ value: "+351", label: "PT +351" });
    expect(dialCodeOptions.at(-1)).toEqual({ value: "+91", label: "IN +91" });
  });
});
