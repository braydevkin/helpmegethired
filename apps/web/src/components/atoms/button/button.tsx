import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button {...props} className={classNames(styles.button, styles[variant], className)} />;
}
