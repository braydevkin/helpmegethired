import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./code-box.module.css";

export interface CodeBoxProps extends Omit<ComponentProps<"input">, "type" | "maxLength" | "inputMode"> {
  invalid?: boolean;
}

export function CodeBox({ invalid = false, className, ...props }: CodeBoxProps) {
  return (
    <input
      aria-label="Verification digit"
      {...props}
      type="text"
      inputMode="numeric"
      maxLength={1}
      aria-invalid={invalid || undefined}
      className={classNames(styles.box, className)}
    />
  );
}
