import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./chip.module.css";

export interface ChipProps extends ComponentProps<"span"> {
  compact?: boolean;
}

// A skill as the Profile shows it: a pill in the skills groups, tighter inside an entry.
export function Chip({ compact = false, className, ...props }: ChipProps) {
  return <span {...props} className={classNames(styles.chip, compact && styles.compact, className)} />;
}
