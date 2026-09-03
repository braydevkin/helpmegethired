import { useId, type ReactNode } from "react";

import { ErrorMessage } from "../../atoms/error-message/error-message";
import { Hint } from "../../atoms/hint/hint";
import { Label } from "../../atoms/label/label";
import styles from "./field.module.css";

export interface FieldControlProps {
  id: string;
  invalid: boolean;
  "aria-describedby": string | undefined;
}

export interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

export function Field({ id, label, hint, error, optional = false, className, children }: FieldProps) {
  const messageId = useId();
  const hintId = hint ? `${messageId}-hint` : undefined;
  const errorId = error ? `${messageId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <div className={styles.labelRow}>
        <Label htmlFor={id}>{label}</Label>
        {optional && <span className={styles.optional}>Optional</span>}
      </div>
      {children({ id, invalid: Boolean(error), "aria-describedby": describedBy })}
      {hint && (
        <Hint id={hintId} className={styles.hint}>
          {hint}
        </Hint>
      )}
      {error && (
        <ErrorMessage id={errorId} className={styles.error}>
          {error}
        </ErrorMessage>
      )}
    </div>
  );
}
