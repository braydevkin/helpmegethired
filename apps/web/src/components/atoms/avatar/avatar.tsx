import { classNames } from "../../../lib/class-names";
import styles from "./avatar.module.css";

export interface AvatarProps {
  initials: string;
  name: string;
  className?: string;
}

// The Candidate's initials in a tinted circle; the name is the accessible label.
export function Avatar({ initials, name, className }: AvatarProps) {
  return (
    <span role="img" aria-label={name} className={classNames(styles.avatar, className)}>
      {initials}
    </span>
  );
}
