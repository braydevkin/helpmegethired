import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResendCountdown } from "./resend-countdown";

describe("ResendCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down from the send time and then offers to resend", () => {
    const onResend = vi.fn();

    render(<ResendCountdown sentAt={Date.now()} onResend={onResend} />);

    expect(screen.getByText("Resend in 1:00")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(18_000);
    });

    expect(screen.getByText("Resend in 0:42")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(42_000);
    });

    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));

    expect(onResend).toHaveBeenCalledTimes(1);
  });

  it("restarts when a new code is sent", () => {
    const { rerender } = render(<ResendCountdown sentAt={Date.now()} onResend={vi.fn()} seconds={5} />);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByRole("button", { name: "Resend code" })).toBeInTheDocument();

    rerender(<ResendCountdown sentAt={Date.now()} onResend={vi.fn()} seconds={5} />);

    expect(screen.getByText("Resend in 0:05")).toBeInTheDocument();
  });
});
