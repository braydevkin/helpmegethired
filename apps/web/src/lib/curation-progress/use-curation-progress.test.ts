import type { CurationProgressState } from "@helpmegethired/shared";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { progressOf, unitsOf } from "./curation-progress.fixtures";
import { useCurationProgress, type ReadCuration } from "./use-curation-progress";

const running = (saved: number): CurationProgressState => ({ progress: progressOf(unitsOf(4, saved)) });

const changed = (state: CurationProgressState, etag: string) => ({ ok: true as const, value: { changed: true as const, state, etag } });
const unchanged = { ok: true as const, value: { changed: false as const } };

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("useCurationProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks again with the last ETag and renders the answer", async () => {
    const read = vi.fn<ReadCuration>().mockResolvedValueOnce(changed(running(1), '"one"')).mockResolvedValue(unchanged);
    const { result } = renderHook(() => useCurationProgress(running(0), read));

    await advance(1_000);

    expect(read).toHaveBeenNthCalledWith(1, undefined);
    expect(result.current.state.progress?.percentage).toBe(25);

    await advance(1_000);

    expect(read).toHaveBeenNthCalledWith(2, '"one"');
  });

  it("keeps the last payload on a 304 or a failed read and backs off", async () => {
    const read = vi.fn<ReadCuration>().mockResolvedValueOnce(unchanged).mockResolvedValueOnce({ ok: false, message: "lost" }).mockResolvedValue(unchanged);
    const { result } = renderHook(() => useCurationProgress(running(2), read));

    await advance(1_000);
    await advance(2_000);

    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.state.progress?.percentage).toBe(50);

    await advance(3_999);

    expect(read).toHaveBeenCalledTimes(2);

    await advance(1);

    expect(read).toHaveBeenCalledTimes(3);
  });

  it.each(["completed", "failed", "cancelled", "superseded"] as const)("stops once the Curation is %s", async (status) => {
    const settled = { progress: progressOf(unitsOf(4, 2, 0), { status, failureReason: status === "failed" ? "attempts_exhausted" : null }) };
    const read = vi.fn<ReadCuration>().mockResolvedValue(changed(settled, '"settled"'));
    const { result } = renderHook(() => useCurationProgress(running(2), read));

    await advance(1_000);
    await advance(60_000);

    expect(read).toHaveBeenCalledTimes(1);
    expect(result.current.state.progress?.status).toBe(status);
  });

  it("never asks while there is no Curation to watch", async () => {
    const read = vi.fn<ReadCuration>();

    renderHook(() => useCurationProgress({ progress: null }, read));
    await advance(60_000);

    expect(read).not.toHaveBeenCalled();
  });

  it("watches again from the state an action answered with", async () => {
    const read = vi.fn<ReadCuration>().mockResolvedValue(unchanged);
    const failed = { progress: progressOf(unitsOf(4, 2, 0), { status: "failed", failureReason: "attempts_exhausted" }) };
    const { result } = renderHook(() => useCurationProgress(failed, read));

    await advance(10_000);
    expect(read).not.toHaveBeenCalled();

    act(() => result.current.replace({ progress: progressOf(unitsOf(4, 2, 0), { status: "queued" }) }));
    await advance(1_000);

    expect(result.current.state.progress?.status).toBe("queued");
    expect(read).toHaveBeenCalledWith(undefined);
  });
});
