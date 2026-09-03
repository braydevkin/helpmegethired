import { useId } from "react";

import { ErrorMessage } from "../../atoms/error-message/error-message";
import { Label } from "../../atoms/label/label";
import { Select } from "../../atoms/select/select";
import { TextInput } from "../../atoms/text-input/text-input";
import styles from "./phone-field.module.css";

export interface DialCodeOption {
  value: string;
  label: string;
}

export interface PhoneFieldProps {
  id: string;
  dialCodes: readonly DialCodeOption[];
  defaultDialCode: string;
  dialCodeName: string;
  numberName: string;
  label?: string;
  error?: string;
  defaultNumber?: string;
}

export function PhoneField({
  id,
  dialCodes,
  defaultDialCode,
  dialCodeName,
  numberName,
  label = "Phone",
  error,
  defaultNumber,
}: PhoneFieldProps) {
  const errorId = useId();
  const invalid = Boolean(error);

  return (
    <div className={styles.field}>
      <Label htmlFor={id}>{label}</Label>
      <div className={styles.controls}>
        <Select
          aria-label="Country code"
          name={dialCodeName}
          defaultValue={defaultDialCode}
          invalid={invalid}
          className={styles.dialCode}
        >
          {dialCodes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <TextInput
          id={id}
          name={numberName}
          type="tel"
          autoComplete="tel-national"
          placeholder="912 345 678"
          density="compact"
          defaultValue={defaultNumber}
          invalid={invalid}
          aria-describedby={error ? errorId : undefined}
          className={styles.number}
        />
      </div>
      {error && <ErrorMessage id={errorId}>{error}</ErrorMessage>}
    </div>
  );
}
