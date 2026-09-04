import type { ReactNode } from "react";

import { Eyebrow } from "../../atoms/eyebrow/eyebrow";
import styles from "./screen-heading.module.css";

export interface ScreenHeadingProps {
  eyebrow: string;
  title: string;
  lead: ReactNode;
}

export function ScreenHeading({ eyebrow, title, lead }: ScreenHeadingProps) {
  return (
    <div className={styles.heading}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{lead}</p>
    </div>
  );
}
