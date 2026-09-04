import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary";

interface ButtonLook {
  variant?: ButtonVariant;
  className?: string;
  children?: ReactNode;
}

export type LinkButtonProps = ButtonLook & Omit<ComponentProps<typeof Link>, "className" | "children">;
export type NativeButtonProps = ButtonLook & Omit<ComponentProps<"button">, "className" | "children">;
export type ButtonProps = LinkButtonProps | NativeButtonProps;

export function Button(props: ButtonProps) {
  return "href" in props ? <LinkButton {...props} /> : <NativeButton {...props} />;
}

function LinkButton({ variant = "primary", className, children, ...props }: LinkButtonProps) {
  return (
    <Link {...props} className={classNames(styles.button, styles[variant], className)}>
      {children}
    </Link>
  );
}

function NativeButton({ variant = "primary", className, children, ...props }: NativeButtonProps) {
  return (
    <button {...props} className={classNames(styles.button, styles[variant], className)}>
      {children}
    </button>
  );
}
