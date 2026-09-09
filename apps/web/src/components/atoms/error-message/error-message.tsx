import type { ComponentProps } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./error-message.module.css";

export type ErrorMessageProps = ComponentProps<"p">;

export function ErrorMessage({ className, ...props }: ErrorMessageProps) {
  return <p role="alert" {...props} className={classNames(styles.error, className)} />;
}
