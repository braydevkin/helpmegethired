import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./select.module.css";

export interface SelectProps extends ComponentProps<"select"> {
  invalid?: boolean;
}

export function Select({ invalid = false, className, ...props }: SelectProps) {
  return <select {...props} aria-invalid={invalid || undefined} className={classNames(styles.select, className)} />;
}
