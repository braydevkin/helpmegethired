import { describe, expect, it } from "vitest";

import { DevelopmentCodeSender } from "./development-code-sender";
import { MissingCodeSenderError, selectCodeSender } from "./select-code-sender";

describe("selectCodeSender", () => {
  it.each(["development", "test"] as const)("logs the code in %s", (NODE_ENV) => {
    expect(selectCodeSender({ NODE_ENV })).toBeInstanceOf(DevelopmentCodeSender);
  });

  it("refuses to start in production without a real sender", () => {
    expect(() => selectCodeSender({ NODE_ENV: "production" })).toThrow(MissingCodeSenderError);
  });
});
