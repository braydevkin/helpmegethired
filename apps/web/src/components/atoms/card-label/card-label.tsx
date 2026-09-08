import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./card-label.module.css";

export type CardLabelProps = ComponentProps<"p">;

export function CardLabel({ className, ...props }: CardLabelProps) {
  return <p {...props} className={classNames(styles.label, className)} />;
}
