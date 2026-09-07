import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pollUntil } from "./poll-until";

describe("pollUntil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers true on the first passing check without waiting", async () => {
    const check = vi.fn().mockResolvedValue(true);

    await expect(pollUntil(check, { attempts: 3, delayMs: 500 })).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("waits the delay between attempts and answers true once the check passes", async () => {
    const check = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true);
    const pending = pollUntil(check, { attempts: 3, delayMs: 500 });

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(3);
  });

  it("answers false after the last attempt without a trailing wait", async () => {
    const check = vi.fn().mockResolvedValue(false);
    const pending = pollUntil(check, { attempts: 3, delayMs: 500 });

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toBe(false);
    expect(check).toHaveBeenCalledTimes(3);
  });
});
