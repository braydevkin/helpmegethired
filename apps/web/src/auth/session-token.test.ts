import { describe, expect, it } from "vitest";

import { hashSessionToken } from "./session-token";

describe("hashSessionToken", () => {
  it("is the hex SHA-256 digest the API stores in sessions.token_hash", () => {
    expect(hashSessionToken("opaque-token")).toBe("84d3f23da9b5f51b3269566eff05d3fb23607eeef89567f9cd280b90ca0dbc5c");
  });

  it("tells tokens apart", () => {
    expect(hashSessionToken("opaque-token")).not.toBe(hashSessionToken("another-token"));
  });
});
