import { describe, expect, it, vi } from "vitest";

import { DevelopmentCodeSender } from "./development-code-sender";

const delivery = { email: "ada@example.com", code: "123456", expiresAt: new Date() };

describe("DevelopmentCodeSender", () => {
  it("logs the code instead of sending an email", async () => {
    const log = vi.fn();
    const sender = new DevelopmentCodeSender(log, new Map());

    await sender.send(delivery);

    expect(log).toHaveBeenCalledWith("Verification code for ada@example.com: 123456");
  });

  it("keeps the last code sent to each email", async () => {
    const sender = new DevelopmentCodeSender(vi.fn(), new Map());

    await sender.send(delivery);
    await sender.send({ ...delivery, code: "654321" });
    await sender.send({ ...delivery, email: "grace@example.com", code: "111111" });

    expect(sender.lastCodeFor("ada@example.com")).toBe("654321");
    expect(sender.lastCodeFor("grace@example.com")).toBe("111111");
    expect(sender.lastCodeFor("nobody@example.com")).toBeUndefined();
  });

  it("shares the codes between instances so a route can read what the sender stored", async () => {
    await new DevelopmentCodeSender(vi.fn()).send(delivery);

    expect(new DevelopmentCodeSender(vi.fn()).lastCodeFor(delivery.email)).toBe(delivery.code);
  });
});
