import { Injectable } from "@nestjs/common";
import type { DraftBasicProfile } from "@helpmegethired/shared";

import { AccountRepository } from "../../auth/account.repository";
import { UploadedResumeRunRepository } from "../../extraction/uploaded-resume-run.repository";
import type { SegmentContext } from "../../ingestion/segment-processor";
import { basicProfileOf, extractContact, normalise, splitSections, topLinesOf } from "../../parser";
import { ProfileRepository } from "../profile.repository";
import type { RecognizedHeader } from "./recognized";
import { ResumeSegmentProcessor, type ResumeSegmentContent } from "./resume-segment.processor";

export class AccountMissingError extends Error {
  constructor(accountId: string) {
    super(`No Account with the id ${accountId}`);
    this.name = "AccountMissingError";
  }
}

const sameName = (recognised: string | undefined, name: string | null, lastName: string | null): boolean =>
  recognised === undefined || normalise(recognised) === normalise(`${name ?? ""} ${lastName ?? ""}`);

const sameEmail = (recognised: string | undefined, email: string): boolean =>
  recognised === undefined || recognised.toLowerCase() === email.toLowerCase();

// The name and the e-mail are read only to be compared with the Account: a difference is a
// review flag, and neither is ever written into a Profile table.
@Injectable()
export class HeaderSegmentProcessor extends ResumeSegmentProcessor<RecognizedHeader> {
  readonly kind = "header";

  constructor(
    resumes: UploadedResumeRunRepository,
    private readonly accounts: AccountRepository,
    private readonly profiles: ProfileRepository,
  ) {
    super(resumes);
  }

  async recognize(content: ResumeSegmentContent, context: SegmentContext): Promise<RecognizedHeader> {
    const account = await this.accounts.findById(context.accountId);

    if (!account) {
      throw new AccountMissingError(context.accountId);
    }

    const sections = splitSections(content.lines);
    const contact = extractContact(content.lines.join("\n"), topLinesOf(sections));
    const basicProfile: DraftBasicProfile = basicProfileOf(sections, contact);

    return {
      basicProfile,
      accountMismatch: {
        name: account.name !== null && !sameName(contact.name?.value, account.name, account.lastName),
        email: !sameEmail(contact.email?.value, account.email),
      },
    };
  }

  save(recognized: RecognizedHeader, context: SegmentContext): Promise<void> {
    return this.profiles.saveBasicProfile(context, recognized.basicProfile);
  }
}
