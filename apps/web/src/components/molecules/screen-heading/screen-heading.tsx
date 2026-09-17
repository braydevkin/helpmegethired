import type { ReactNode } from "react";

import { classNames } from "../../../lib/class-names";
import { Eyebrow } from "../../atoms/eyebrow/eyebrow";
import styles from "./screen-heading.module.css";

export type ScreenHeadingTone = "brand" | "warning" | "error";

export interface ScreenHeadingProps {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  size?: "default" | "large";
  tone?: ScreenHeadingTone;
}

export function ScreenHeading({ eyebrow, title, lead, size = "default", tone = "brand" }: ScreenHeadingProps) {
  return (
    <div className={classNames(styles.heading, size === "large" && styles.large)}>
      <Eyebrow className={classNames(tone !== "brand" && styles[tone])}>{eyebrow}</Eyebrow>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{lead}</p>
    </div>
  );
}
