"use client";

import type { BasicProfile } from "@helpmegethired/shared";

import { BasicProfileCard } from "../../../../components/organisms/basic-profile-card/basic-profile-card";
import type { CorrectionAction } from "../../../../lib/profile/correction-form";
import { useProfileEditing } from "./profile-editing";

export interface BasicProfileCorrectionsProps {
  basicProfile: BasicProfile;
  corrected: boolean;
  editable: boolean;
  save: CorrectionAction;
}

const BASIC_PROFILE_EDITOR = "basic-profile";

export function BasicProfileCorrections({ basicProfile, corrected, editable, save }: BasicProfileCorrectionsProps) {
  const editing = useProfileEditing();

  return (
    <BasicProfileCard
      basicProfile={basicProfile}
      corrected={corrected}
      editing={editing.openEditor === BASIC_PROFILE_EDITOR}
      save={save}
      onClose={editing.close}
      onEdit={editable && editing.openEditor === null ? () => editing.open(BASIC_PROFILE_EDITOR) : undefined}
      editRef={editing.returnFocusTo(BASIC_PROFILE_EDITOR)}
    />
  );
}
