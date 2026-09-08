import { describe, expect, it } from "vitest";

import { formatSize, initialsOf } from "./format";

describe("formatSize", () => {
  it("shows megabytes with one decimal and kilobytes rounded", () => {
    expect(formatSize(1.8 * 1024 * 1024)).toBe("1.8 MB");
    expect(formatSize(2 * 1024 * 1024)).toBe("2 MB");
    expect(formatSize(640 * 1024)).toBe("640 KB");
    expect(formatSize(10)).toBe("1 KB");
  });
});

describe("initialsOf", () => {
  it("takes the first letter of the name and the last name", () => {
    expect(initialsOf("Ada", "Lovelace")).toBe("AL");
    expect(initialsOf("ada", null)).toBe("A");
    expect(initialsOf(null, null)).toBe("?");
  });
});
