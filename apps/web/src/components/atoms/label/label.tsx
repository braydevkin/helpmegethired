import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./label.module.css";

export type LabelProps = ComponentProps<"label">;

export function Label({ className, ...props }: LabelProps) {
  return <label {...props} className={classNames(styles.label, className)} />;
}
