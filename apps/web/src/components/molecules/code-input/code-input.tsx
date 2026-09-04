"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
} from "react";

import { CodeBox } from "../../atoms/code-box/code-box";
import { ErrorMessage } from "../../atoms/error-message/error-message";
import styles from "./code-input.module.css";

export interface CodeInputProps {
  name: string;
  length?: number;
  error?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onChange?: (code: string) => void;
}

const DEFAULT_LENGTH = 6;
const NON_DIGITS = /\D/g;
const SINGLE_DIGIT = /^\d$/;

const selectContent = (event: FocusEvent<HTMLInputElement>) => event.target.select();

export function CodeInput({
  name,
  length = DEFAULT_LENGTH,
  error,
  autoFocus = false,
  disabled = false,
  onChange,
}: CodeInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length }, () => ""));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const errorId = useId();

  function update(next: string[]) {
    setDigits(next);
    onChange?.(next.join(""));
  }

  function focusBox(index: number) {
    boxes.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  }

  function fillFrom(index: number, typed: string) {
    const characters = typed.replace(NON_DIGITS, "").split("");
    const next = [...digits];

    if (characters.length === 0) {
      next[index] = "";
      update(next);
      return;
    }

    let cursor = index;

    for (const character of characters) {
      if (cursor >= length) {
        break;
      }
      next[cursor] = character;
      cursor += 1;
    }

    update(next);
    focusBox(cursor);
  }

  const handleChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) =>
    fillFrom(index, event.target.value);

  const handlePaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    fillFrom(index, event.clipboardData.getData("text"));
  };

  // A box holds one character, so the browser refuses a second one; handling the
  // digit key here lets a Candidate overwrite a box without deleting it first.
  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (SINGLE_DIGIT.test(event.key)) {
      event.preventDefault();
      fillFrom(index, event.key);
    } else if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      update(next);
      focusBox(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  return (
    <div className={styles["code-input"]}>
      <fieldset aria-label="Verification code" aria-describedby={error ? errorId : undefined} className={styles.boxes}>
        {digits.map((digit, index) => (
          <CodeBox
            key={`${name}-${index}`}
            aria-label={`Verification digit ${index + 1}`}
            ref={(element) => {
              boxes.current[index] = element;
            }}
            value={digit}
            autoFocus={autoFocus && index === 0}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            invalid={Boolean(error)}
            disabled={disabled}
            onChange={handleChange(index)}
            onPaste={handlePaste(index)}
            onKeyDown={handleKeyDown(index)}
            onFocus={selectContent}
          />
        ))}
      </fieldset>
      <input type="hidden" name={name} value={digits.join("")} />
      {error && <ErrorMessage id={errorId}>{error}</ErrorMessage>}
    </div>
  );
}
