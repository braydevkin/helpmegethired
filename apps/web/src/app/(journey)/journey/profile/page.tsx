import type { Metadata } from "next";

import { Button } from "../../../../components/atoms/button/button";
import { ScreenHeading } from "../../../../components/molecules/screen-heading/screen-heading";
import { RESUME_STEP_PATH } from "../../../paths";
import { requireCandidate } from "../candidate";
import { JourneyFrame } from "../journey-frame";

export const metadata: Metadata = { title: "Your profile | Help Me Get Hired" };

// The Profile page arrives with its own task (#70); the upload step needs somewhere to land.
export default async function ProfilePage() {
  const candidate = await requireCandidate();

  return (
    <JourneyFrame candidate={candidate} stepLabel="Step 2 · Your profile">
      <ScreenHeading
        size="large"
        eyebrow="Coming up"
        title="Your profile"
        lead="The Profile review page arrives with the next task. Your Profile is built and waiting for it."
      />
      <Button variant="secondary" href={RESUME_STEP_PATH}>
        Back to the résumé step
      </Button>
    </JourneyFrame>
  );
}
