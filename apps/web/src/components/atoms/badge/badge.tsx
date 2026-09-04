import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./badge.module.css";

export type BadgeProps = ComponentProps<"span">;

export function Badge({ className, ...props }: BadgeProps) {
  return <span {...props} className={classNames(styles.badge, className)} />;
}
