import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./text-input.module.css";

export type ControlDensity = "regular" | "compact";

export interface TextInputProps extends ComponentProps<"input"> {
  density?: ControlDensity;
  invalid?: boolean;
}

export function TextInput({ density = "regular", invalid = false, className, ...props }: TextInputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={classNames(styles.input, styles[density], className)}
    />
  );
}
