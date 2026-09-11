import { Injectable, Logger } from "@nestjs/common";
import type { AccountModelChoice, Id, ModelChoiceRequest, ModelChoiceState } from "@helpmegethired/shared";

import { CurationStarter } from "../curation/curation-starter";
import { ModelChoiceNotFoundError, ModelKeyNotFoundError, ModelKeyRefusedError, type ModelKeyRefusal } from "./model-choice-errors";
import { ModelChoiceRepository, type StoredModelChoice } from "./model-choice.repository";
import { ModelKey, type UsableModelKey } from "./model-key";
import { ModelKeyCipher } from "./model-key-cipher";
import { ModelKeyValidator, type ModelKeyVerdict } from "./model-key-validator";

const REFUSAL_OF: Record<Exclude<ModelKeyVerdict, "valid">, ModelKeyRefusal> = {
  invalid: "model_key_invalid",
  not_permitted: "model_key_not_permitted",
  unavailable: "provider_unavailable",
};

const choiceOf = ({ provider, modelId, sealedKey }: StoredModelChoice): AccountModelChoice => ({
  provider,
  modelId,
  keyStored: sealedKey !== null,
});

// Log lines carry the Account, the Provider, and the Model, never the key (docs/security.md).
@Injectable()
export class ModelChoiceService {
  private readonly logger = new Logger(ModelChoiceService.name);

  constructor(
    private readonly choices: ModelChoiceRepository,
    private readonly cipher: ModelKeyCipher,
    private readonly validator: ModelKeyValidator,
    private readonly curations: CurationStarter,
  ) {}

  async get(accountId: Id): Promise<ModelChoiceState> {
    const stored = await this.choices.find(accountId);

    return { choice: stored ? choiceOf(stored) : null };
  }

  // The key is checked with the Provider before anything is stored, so a key it refuses never
  // replaces one that works. Storing it on a confirmed Profile starts the Curation (ADR-0024).
  async save(accountId: Id, { provider, modelId, key }: ModelChoiceRequest): Promise<AccountModelChoice> {
    const verdict = await this.validator.validate({ provider, modelId }, key);

    if (verdict !== "valid") {
      const refusal = REFUSAL_OF[verdict];

      this.logger.warn(`Model Key refused for Account ${accountId} at ${provider}/${modelId}: ${refusal}`);
      throw new ModelKeyRefusedError(refusal);
    }

    const sealedKey = this.cipher.seal(accountId, key);
    const stored = await this.curations.commitAndStart(accountId, (transaction) => this.choices.save(accountId, { provider, modelId, sealedKey }, transaction));

    this.logger.log(`Model Choice saved for Account ${accountId} at ${provider}/${modelId}`);

    return choiceOf(stored);
  }

  async revokeKey(accountId: Id): Promise<AccountModelChoice> {
    const stored = await this.choices.revokeKey(accountId);

    if (!stored) {
      throw new ModelChoiceNotFoundError(accountId);
    }

    this.logger.log(`Model Key revoked for Account ${accountId} at ${stored.provider}/${stored.modelId}`);

    return choiceOf(stored);
  }

  // What creating a Curation asks for (#112): the Account's usable key, or a refusal the
  // Candidate can act on.
  async usableModelKey(accountId: Id): Promise<UsableModelKey> {
    const stored = await this.choices.find(accountId);

    if (!stored?.sealedKey) {
      throw new ModelKeyNotFoundError(accountId);
    }

    return { provider: stored.provider, modelId: stored.modelId, key: new ModelKey(this.cipher.open(accountId, stored.sealedKey)) };
  }
}
