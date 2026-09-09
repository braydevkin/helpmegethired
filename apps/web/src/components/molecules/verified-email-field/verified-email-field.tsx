import { Badge } from "../../atoms/badge/badge";
import { Label } from "../../atoms/label/label";
import { TextInput } from "../../atoms/text-input/text-input";
import styles from "./verified-email-field.module.css";

export interface VerifiedEmailFieldProps {
  id: string;
  email: string;
  label?: string;
  badge?: string;
}

export function VerifiedEmailField({ id, email, label = "Email", badge = "Verified" }: VerifiedEmailFieldProps) {
  return (
    <div className={styles.field}>
      <Label htmlFor={id}>{label}</Label>
      <div className={styles.control}>
        <TextInput id={id} type="email" value={email} readOnly density="compact" className={styles.input} />
        <Badge className={styles.badge}>{badge}</Badge>
      </div>
    </div>
  );
}
