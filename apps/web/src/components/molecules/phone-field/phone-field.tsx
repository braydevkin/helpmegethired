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

export interface PhoneFieldDialCode {
  name: string;
  options: readonly DialCodeOption[];
  defaultValue: string;
}

export interface PhoneFieldNumber {
  name: string;
  defaultValue?: string;
}

export interface PhoneFieldProps {
  id: string;
  dialCode: PhoneFieldDialCode;
  number: PhoneFieldNumber;
  label?: string;
  error?: string;
}

export function PhoneField({ id, dialCode, number, label = "Phone", error }: PhoneFieldProps) {
  const errorId = useId();
  const invalid = Boolean(error);

  return (
    <div className={styles.field}>
      <Label htmlFor={id}>{label}</Label>
      <div className={styles.controls}>
        <Select
          aria-label="Country code"
          name={dialCode.name}
          defaultValue={dialCode.defaultValue}
          invalid={invalid}
          className={styles["dial-code"]}
        >
          {dialCode.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <TextInput
          id={id}
          name={number.name}
          type="tel"
          autoComplete="tel-national"
          placeholder="912 345 678"
          density="compact"
          defaultValue={number.defaultValue}
          invalid={invalid}
          aria-describedby={error ? errorId : undefined}
          className={styles.number}
        />
      </div>
      {error && <ErrorMessage id={errorId}>{error}</ErrorMessage>}
    </div>
  );
}
