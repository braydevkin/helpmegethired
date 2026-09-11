import type { CurationProgressState } from "@helpmegethired/shared";
import { useCallback, useEffect, useState } from "react";

import type { CurationRead } from "../curation-client";
import { pollDelayMs } from "../poll-delay";
import { isSettled } from "./view";

export type CurationReadResult = { ok: true; value: CurationRead } | { ok: false; message: string };

export type ReadCuration = (etag: string | undefined) => Promise<CurationReadResult>;

interface Polling {
  state: CurationProgressState;
  etag: string | undefined;
  attempt: number;
}

// While the Curation is queued or running, asks again with the last ETag after 1 s, 2 s, 4 s,
// 8 s, then every 10 s, and stops once it settles. `replace` takes the state a cancel, retry,
// or re-run answered with and starts watching it afresh. `read` must keep its identity across
// renders, as a server action does, or every render restarts the wait.
export function useCurationProgress(initial: CurationProgressState, read: ReadCuration): { state: CurationProgressState; replace: (state: CurationProgressState) => void } {
  const [polling, setPolling] = useState<Polling>({ state: initial, etag: undefined, attempt: 0 });

  useEffect(() => {
    if (isSettled(polling.state)) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await read(polling.etag);

      if (cancelled) {
        return;
      }

      setPolling((previous) =>
        result.ok && result.value.changed ? { state: result.value.state, etag: result.value.etag, attempt: 0 } : { ...previous, attempt: previous.attempt + 1 },
      );
    }, pollDelayMs(polling.attempt));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [polling, read]);

  const replace = useCallback((state: CurationProgressState) => setPolling({ state, etag: undefined, attempt: 0 }), []);

  return { state: polling.state, replace };
}
