import { LogoMark } from "../../atoms/logo-mark/logo-mark";
import styles from "./brand-panel.module.css";

export const BRAND_NAME = "Help me get hired";
export const BRAND_TAGLINE = "Show up to the interview already prepared.";
export const BRAND_LEAD =
  "Practice the interviews, sharpen the résumé, and understand the reasoning behind every step.";
export const BRAND_CLAIMS = [
  "Mock interviews with instant feedback",
  "Role-matched résumé rewrites",
  "A study plan built from your gaps",
] as const;
export const BRAND_FOOTER = "No passwords. We send a one-time code every time.";

export interface BrandPanelProps {
  className?: string;
}

export function BrandPanel({ className }: BrandPanelProps) {
  return (
    <aside aria-label={BRAND_NAME} className={[styles.panel, className].filter(Boolean).join(" ")}>
      <div aria-hidden="true" className={styles.glow} />
      <div className={styles.brand}>
        <LogoMark />
        <span className={styles.name}>{BRAND_NAME}</span>
      </div>
      <div className={styles.message}>
        <p className={styles.tagline}>{BRAND_TAGLINE}</p>
        <p className={styles.lead}>{BRAND_LEAD}</p>
        <ul className={styles.claims}>
          {BRAND_CLAIMS.map((claim) => (
            <li key={claim} className={styles.claim}>
              <span aria-hidden="true" className={styles.check}>
                ✓
              </span>
              {claim}
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.footer}>{BRAND_FOOTER}</p>
    </aside>
  );
}
