import { Button } from "../../../../components/atoms/button/button";
import { LockedEntry } from "../../../../components/molecules/locked-entry/locked-entry";
import { ScreenHeading } from "../../../../components/molecules/screen-heading/screen-heading";
import { jobMatchingLockOf } from "../../../../lib/curation-analysis/view";
import styles from "./analysis.module.css";

export interface ModelChoiceFirstProps {
  modelChoiceHref: string;
}

export function ModelChoiceFirst({ modelChoiceHref }: ModelChoiceFirstProps) {
  return (
    <div className={styles.gate}>
      <ScreenHeading
        eyebrow="One step first"
        title="Choose your AI to start the analysis"
        lead="Your profile is confirmed. The analysis runs on your own AI provider account: choose it and save your key, and the analysis starts on its own."
      />
      <div className={styles.actions}>
        <Button href={modelChoiceHref}>Choose your AI</Button>
      </div>
      <LockedEntry label="Paste a job description" reason={jobMatchingLockOf(false)} />
    </div>
  );
}
