import { classNames } from "../../../lib/class-names";
import styles from "./logo-mark.module.css";

export interface LogoMarkProps {
  className?: string;
}

export function LogoMark({ className }: LogoMarkProps) {
  return (
    <span aria-hidden="true" className={classNames(styles.mark, className)}>
      H
    </span>
  );
}
