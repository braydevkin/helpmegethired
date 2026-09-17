import { Injectable } from "@nestjs/common";
import type { BasicProfile, Id, Profile, ProfileListPart } from "@helpmegethired/shared";

import { IngestionRepository } from "../ingestion/ingestion.repository";
import { ProfileConfirmedError, ProfileEntryNotFoundError, ProfileNotFoundError } from "./profile-errors";
import { ProfileCorrectionRepository } from "./profile-correction.repository";
import { RESUME_SOURCE, ProfileService } from "./profile.service";

// Correcting is the Candidate's answer to what the recognition got wrong. It writes on the
// rows of their latest completed Ingestion, and only until they confirm the Profile: the
// confirmation starts the Curation that reads it.
@Injectable()
export class ProfileCorrectionService {
  constructor(
    private readonly profiles: ProfileService,
    private readonly corrections: ProfileCorrectionRepository,
    private readonly ingestions: IngestionRepository,
  ) {}

  async correctBasicProfile(accountId: Id, basicProfile: BasicProfile): Promise<Profile> {
    const ingestionId = await this.correctableIngestionOf(accountId);

    if (!(await this.corrections.updateBasicProfile(accountId, ingestionId, basicProfile))) {
      throw new ProfileNotFoundError(accountId);
    }

    return this.profiles.get(accountId);
  }

  async addEntry(accountId: Id, part: ProfileListPart, body: unknown): Promise<Profile> {
    await this.corrections.addEntry(accountId, await this.correctableIngestionOf(accountId), part, body);

    return this.profiles.get(accountId);
  }

  async replaceEntry(accountId: Id, part: ProfileListPart, entryId: Id, body: unknown): Promise<Profile> {
    await this.correctableIngestionOf(accountId);

    if (!(await this.corrections.replaceEntry(accountId, part, entryId, body))) {
      throw new ProfileEntryNotFoundError(part, entryId);
    }

    return this.profiles.get(accountId);
  }

  async removeEntry(accountId: Id, part: ProfileListPart, entryId: Id): Promise<Profile> {
    await this.correctableIngestionOf(accountId);

    if (!(await this.corrections.removeEntry(accountId, part, entryId))) {
      throw new ProfileEntryNotFoundError(part, entryId);
    }

    return this.profiles.get(accountId);
  }

  private async correctableIngestionOf(accountId: Id): Promise<Id> {
    const ingestion = await this.ingestions.findLatestCompleted(accountId, RESUME_SOURCE);

    if (!ingestion) {
      throw new ProfileNotFoundError(accountId);
    }

    if (await this.corrections.isConfirmed(accountId, ingestion.id)) {
      throw new ProfileConfirmedError(accountId);
    }

    return ingestion.id;
  }
}
