import type { ReactNode } from "react";

import { BrandPanel } from "../../organisms/brand-panel/brand-panel";
import styles from "./account-template.module.css";

export interface AccountTemplateProps {
  children: ReactNode;
}

export function AccountTemplate({ children }: AccountTemplateProps) {
  return (
    <div className={styles.layout}>
      <BrandPanel className={styles.panel} />
      <main className={styles.column}>
        <div className={styles.card}>{children}</div>
      </main>
    </div>
  );
}
