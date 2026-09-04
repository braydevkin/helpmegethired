import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./eyebrow.module.css";

export type EyebrowProps = ComponentProps<"p">;

export function Eyebrow({ className, ...props }: EyebrowProps) {
  return <p {...props} className={classNames(styles.eyebrow, className)} />;
}
