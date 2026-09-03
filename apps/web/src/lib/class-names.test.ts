import { describe, expect, it } from "vitest";

import { classNames } from "./class-names";

describe("classNames", () => {
  it("joins the names that are set and drops the rest", () => {
    expect(classNames("button", false, undefined, "primary")).toBe("button primary");
  });
});
