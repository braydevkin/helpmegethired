import type { CurationActionErrorCode, CurationProgressState } from "@helpmegethired/shared";
import { useState, useTransition } from "react";

import { cancelCurationAction, rerunCurationAction, retryCurationAction, type AnalysisActionResult } from "./actions";

type ProgressAction = () => Promise<AnalysisActionResult<CurationProgressState>>;

// Answers whether the refusal was shown in place, so it is not repeated above the page.
type RefusalHandler = (code: CurationActionErrorCode | undefined, message: string) => boolean;

export interface CurationActions {
  acting: boolean;
  message: string | undefined;
  rerunInstead: boolean;
  rerunRefusal: string | undefined;
  stop: () => void;
  tryAgain: () => void;
  runAgain: () => void;
}

// A retry cannot resume a Curation begun under another Model, so the page offers the re-run instead.
const RERUN_INSTEAD_OF_RETRY: ReadonlySet<CurationActionErrorCode> = new Set(["curation_model_changed", "curation_not_retryable"]);

const offeringRerunWith =
  (setRerunInstead: (offered: boolean) => void): RefusalHandler =>
  (code) => {
    setRerunInstead(code !== undefined && RERUN_INSTEAD_OF_RETRY.has(code));

    return false;
  };

const explainingUnchangedWith =
  (setRerunRefusal: (reason: string) => void): RefusalHandler =>
  (code, message) => {
    if (code !== "curation_unchanged") {
      return false;
    }

    setRerunRefusal(message);

    return true;
  };

// Stop, try again, and run it again, one at a time; each answer replaces the progress the page watches.
export function useCurationActions(replace: (state: CurationProgressState) => void): CurationActions {
  const [message, setMessage] = useState<string>();
  const [rerunInstead, setRerunInstead] = useState(false);
  const [rerunRefusal, setRerunRefusal] = useState<string>();
  const [acting, startAction] = useTransition();

  const act = (action: ProgressAction, onRefused?: RefusalHandler) => {
    if (acting) {
      return;
    }

    startAction(async () => {
      setMessage(undefined);

      const result = await action();

      if (result.ok) {
        setRerunInstead(false);
        replace(result.value);
      } else if (!onRefused?.(result.code, result.message)) {
        setMessage(result.message);
      }
    });
  };

  return {
    acting,
    message,
    rerunInstead,
    rerunRefusal,
    stop: () => act(cancelCurationAction),
    tryAgain: () => act(retryCurationAction, offeringRerunWith(setRerunInstead)),
    runAgain: () => act(rerunCurationAction, explainingUnchangedWith(setRerunRefusal)),
  };
}
