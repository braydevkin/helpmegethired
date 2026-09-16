"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode, type RefCallback } from "react";

export interface ProfileEditing {
  openEditor: string | null;
  open: (editor: string) => void;
  close: () => void;
  returnFocusTo: (editor: string) => RefCallback<HTMLElement>;
}

const ProfileEditingContext = createContext<ProfileEditing | null>(null);

// One correction is open on the Profile step at a time, whichever card it belongs to, and
// Confirm waits for it. Closing an editor hands the focus back to the control that opened it,
// which renders again once the form is gone.
export function ProfileEditingProvider({ children }: { children: ReactNode }) {
  const [openEditor, setOpenEditor] = useState<string | null>(null);
  const closedEditor = useRef<string | null>(null);

  const editing = useMemo<ProfileEditing>(
    () => ({
      openEditor,
      open: setOpenEditor,
      close: () => {
        closedEditor.current = openEditor;
        setOpenEditor(null);
      },
      returnFocusTo: (editor) => (node) => {
        if (node && closedEditor.current === editor) {
          closedEditor.current = null;
          node.focus();
        }
      },
    }),
    [openEditor],
  );

  return <ProfileEditingContext.Provider value={editing}>{children}</ProfileEditingContext.Provider>;
}

export function useProfileEditing(): ProfileEditing {
  const editing = useContext(ProfileEditingContext);

  if (!editing) {
    throw new Error("useProfileEditing needs a ProfileEditingProvider above it");
  }

  return editing;
}
