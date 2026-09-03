import Link from "next/link";
import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  href?: string;
}

export function Button({ variant = "primary", href, className, children, ...props }: ButtonProps) {
  const buttonClassName = classNames(styles.button, styles[variant], className);

  if (href) {
    return (
      <Link href={href} className={buttonClassName}>
        {children}
      </Link>
    );
  }

  return (
    <button {...props} className={buttonClassName}>
      {children}
    </button>
  );
}
