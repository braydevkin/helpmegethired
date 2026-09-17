import { Button } from "../../../../components/atoms/button/button";
import { LockedEntry } from "../../../../components/molecules/locked-entry/locked-entry";
import { ScreenHeading } from "../../../../components/molecules/screen-heading/screen-heading";
import styles from "./resume.module.css";

export interface ModelChoiceBeforeUploadProps {
  modelChoiceHref: string;
}

export const UPLOAD_LOCK_REASON = "Uploading opens once your key is stored: the AI you choose is what reads your résumé.";

export function ModelChoiceBeforeUpload({ modelChoiceHref }: ModelChoiceBeforeUploadProps) {
  return (
    <div className={styles.gate}>
      <ScreenHeading
        size="large"
        eyebrow="One step first"
        title="Choose your AI before you upload"
        lead="Your résumé is read by the AI you choose, on your own key with your own provider account. Choose it and save your key, then come back to upload."
      />
      <div className={styles.actions}>
        <Button href={modelChoiceHref}>Choose your AI</Button>
      </div>
      <LockedEntry label="Upload your résumé" reason={UPLOAD_LOCK_REASON} />
    </div>
  );
}
