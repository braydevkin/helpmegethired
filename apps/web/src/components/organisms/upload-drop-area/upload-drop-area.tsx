"use client";

import { InlineNotice } from "../../atoms/inline-notice/inline-notice";
import { DropZone } from "../../molecules/drop-zone/drop-zone";
import { TipCard } from "../../molecules/tip-card/tip-card";
import styles from "./upload-drop-area.module.css";

export interface UploadDropAreaProps {
  hint: string;
  message?: string;
  disabled?: boolean;
  onFile: (file: File) => void;
}

const TIPS = [
  { title: "Text-based PDFs work best", body: "Scans and screenshots lose data we can't recover." },
  { title: "Keep your links in", body: "GitHub and LinkedIn URLs let us enrich your profile." },
  { title: "Private by default", body: "Only you can see what we extract. Nothing is shared without you." },
];

// The idle state: the drop zone, the rejection under it when a file was refused in the
// browser, and the three tips. The manual-entry line stays hidden (design open point 5).
export function UploadDropArea({ hint, message, disabled, onFile }: UploadDropAreaProps) {
  return (
    <div>
      <DropZone hint={hint} disabled={disabled} onFile={onFile} />
      {message && <InlineNotice>{message}</InlineNotice>}
      <div className={styles.tips}>
        {TIPS.map((tip) => (
          <TipCard key={tip.title} title={tip.title} body={tip.body} />
        ))}
      </div>
    </div>
  );
}
