"use client";

import { ProfileActions, type ProfileActionsProps } from "../../../../components/molecules/profile-actions/profile-actions";
import { useProfileEditing } from "./profile-editing";

export function ProfileReviewActions(props: Omit<ProfileActionsProps, "correcting">) {
  const { openEditor } = useProfileEditing();

  return <ProfileActions {...props} correcting={openEditor !== null} />;
}
