import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { Id } from "@helpmegethired/shared";

import { MODEL_KEY_ENCRYPTION_KEY_BYTES } from "../config/model-key-encryption-key";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 1 + IV_BYTES + TAG_BYTES;

export class ModelKeyDecryptionError extends Error {
  constructor() {
    super("A stored Model Key could not be decrypted");
    this.name = "ModelKeyDecryptionError";
  }
}

// A sealed key is the format version, the IV, the authentication tag, and the ciphertext. The
// version byte lets a later rotation tell old ciphertexts apart, and the Account id is the
// additional authenticated data, so a ciphertext copied onto another Account's row never opens.
export class ModelKeyCipher {
  constructor(private readonly encryptionKey: Buffer) {
    if (encryptionKey.length !== MODEL_KEY_ENCRYPTION_KEY_BYTES) {
      throw new RangeError(`The Model Key encryption key must be ${MODEL_KEY_ENCRYPTION_KEY_BYTES} bytes`);
    }
  }

  seal(accountId: Id, modelKey: string): Buffer {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv, { authTagLength: TAG_BYTES }).setAAD(Buffer.from(accountId));
    const ciphertext = Buffer.concat([cipher.update(modelKey, "utf8"), cipher.final()]);

    return Buffer.concat([Buffer.of(FORMAT_VERSION), iv, cipher.getAuthTag(), ciphertext]);
  }

  open(accountId: Id, sealed: Buffer): string {
    if (sealed.length <= HEADER_BYTES || sealed[0] !== FORMAT_VERSION) {
      throw new ModelKeyDecryptionError();
    }

    const iv = sealed.subarray(1, 1 + IV_BYTES);
    const tag = sealed.subarray(1 + IV_BYTES, HEADER_BYTES);

    try {
      const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv, { authTagLength: TAG_BYTES }).setAAD(Buffer.from(accountId)).setAuthTag(tag);

      return Buffer.concat([decipher.update(sealed.subarray(HEADER_BYTES)), decipher.final()]).toString("utf8");
    } catch {
      throw new ModelKeyDecryptionError();
    }
  }
}
