import { describe, expect, it } from "vitest";

import { sha256Of } from "./sha256";

describe("sha256Of", () => {
  it("answers the lowercase hex digest the API stores", async () => {
    expect(await sha256Of(new Blob(["abc"]))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await sha256Of(new Blob([]))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
