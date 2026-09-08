import { classNames } from "../../../lib/class-names";
import styles from "./file-type-mark.module.css";

export interface FileTypeMarkProps {
  label?: string;
  className?: string;
}

export function FileTypeMark({ label = "PDF", className }: FileTypeMarkProps) {
  return (
    <span aria-hidden="true" className={classNames(styles.mark, className)}>
      {label}
    </span>
  );
}
