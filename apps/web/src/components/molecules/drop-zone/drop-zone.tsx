"use client";

import { PDF_CONTENT_TYPE } from "@helpmegethired/shared";
import { useId, useState, type ChangeEvent, type DragEvent } from "react";

import { classNames } from "../../../lib/class-names";
import styles from "./drop-zone.module.css";

export interface DropZoneProps {
  hint: string;
  disabled?: boolean;
  onFile: (file: File) => void;
}

// The whole zone is the label of a hidden file input, so a click or a keyboard activation
// opens the picker; a drop on it hands the first file over the same way.
export function DropZone({ hint, disabled = false, onFile }: DropZoneProps) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (file) {
      onFile(file);
    }
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);

    const file = event.dataTransfer.files[0];

    if (file && !disabled) {
      onFile(file);
    }
  }

  return (
    <label
      htmlFor={inputId}
      className={classNames(styles.zone, dragging && styles.dragging, disabled && styles.disabled)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      <input id={inputId} type="file" accept={PDF_CONTENT_TYPE} disabled={disabled} className={styles.input} onChange={pick} />
      <span aria-hidden="true" className={styles.icon}>
        ↑
      </span>
      <span className={styles.title}>Drop your PDF here, or browse files</span>
      <span className={styles.hint}>{hint}</span>
    </label>
  );
}
