import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./hint.module.css";

export type HintProps = ComponentProps<"p">;

export function Hint({ className, ...props }: HintProps) {
  return <p {...props} className={classNames(styles.hint, className)} />;
}
