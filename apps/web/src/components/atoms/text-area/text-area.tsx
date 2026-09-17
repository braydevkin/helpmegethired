import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./text-area.module.css";

export interface TextAreaProps extends ComponentProps<"textarea"> {
  invalid?: boolean;
}

export function TextArea({ invalid = false, className, ...props }: TextAreaProps) {
  return <textarea {...props} aria-invalid={invalid || undefined} className={classNames(styles.area, className)} />;
}
