import { startTransition, useActionState, useEffect, useRef, type FormEvent, type RefObject } from "react";

import type { CorrectionAction, CorrectionFailure, CorrectionIssues, CorrectionResult } from "./correction-form";

const FIRST_FIELD = "input:not([type=hidden]), textarea";

export interface CorrectionForm {
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  failure: CorrectionFailure | null;
  issues: CorrectionIssues;
}

// React resets a form once an action given to its `action` prop settles, refused or not, so a
// correction submits from `onSubmit` to keep what the Candidate typed when it is refused. The
// form opens with the focus on its first field, where a keyboard user expects to type.
export function useCorrectionForm(save: CorrectionAction, onSaved: () => void): CorrectionForm {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, dispatch, saving] = useActionState(async (previous: CorrectionResult | null, form: FormData) => {
    const outcome = await save(previous, form);

    if (outcome.ok) {
      onSaved();
    }

    return outcome;
  }, null);

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>(FIRST_FIELD)?.focus();
  }, []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    startTransition(() => dispatch(form));
  };

  const failure = result?.ok === false ? result : null;

  return { formRef, onSubmit, saving, failure, issues: failure?.issues ?? {} };
}
