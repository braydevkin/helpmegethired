import type { ReactNode } from "react";

import { SiteTemplate } from "../../../components/templates/site-template/site-template";
import { signOutAction } from "../../(account)/actions";
import type { Candidate } from "./candidate";

export interface JourneyFrameProps {
  candidate: Candidate;
  stepLabel: string;
  heading?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
}

export function JourneyFrame({ candidate, stepLabel, heading, sidebar, children }: JourneyFrameProps) {
  return (
    <SiteTemplate
      stepLabel={stepLabel}
      candidate={{ initials: candidate.initials, name: candidate.name, email: candidate.account.email }}
      signOut={
        <form action={signOutAction}>
          <button type="submit">Sign out</button>
        </form>
      }
      heading={heading}
      sidebar={sidebar}
    >
      {children}
    </SiteTemplate>
  );
}
