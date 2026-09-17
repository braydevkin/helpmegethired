import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { ModelKeyCipher, ModelKeyDecryptionError } from "./model-key-cipher";

const owner = "3f2d7d5e-6f2a-4c0e-9b1c-0a5b3d5e7f91";
const other = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const modelKey = "sk-ant-api03-a-candidate-key-for-the-cipher-test";
const cipher = new ModelKeyCipher(randomBytes(32));

describe("ModelKeyCipher", () => {
  it("opens what it sealed for the same Account", () => {
    expect(cipher.open(owner, cipher.seal(owner, modelKey))).toBe(modelKey);
  });

  it("never stores the key in the clear, and seals it differently every time", () => {
    const first = cipher.seal(owner, modelKey);
    const second = cipher.seal(owner, modelKey);

    expect(first.includes(Buffer.from(modelKey))).toBe(false);
    expect(first.equals(second)).toBe(false);
  });

  it("refuses a ciphertext moved onto another Account", () => {
    expect(() => cipher.open(other, cipher.seal(owner, modelKey))).toThrow(ModelKeyDecryptionError);
  });

  it("refuses a tampered ciphertext", () => {
    const sealed = cipher.seal(owner, modelKey);

    sealed.writeUInt8(sealed.readUInt8(sealed.length - 1) ^ 0xff, sealed.length - 1);

    expect(() => cipher.open(owner, sealed)).toThrow(ModelKeyDecryptionError);
  });

  it("refuses a key sealed under another encryption key", () => {
    const rotated = new ModelKeyCipher(randomBytes(32));

    expect(() => rotated.open(owner, cipher.seal(owner, modelKey))).toThrow(ModelKeyDecryptionError);
  });

  it("refuses a truncated or unknown format", () => {
    const sealed = cipher.seal(owner, modelKey);
    const unknownVersion = Buffer.from(sealed);

    unknownVersion[0] = 2;

    expect(() => cipher.open(owner, sealed.subarray(0, 20))).toThrow(ModelKeyDecryptionError);
    expect(() => cipher.open(owner, unknownVersion)).toThrow(ModelKeyDecryptionError);
  });

  it("refuses an encryption key of the wrong size", () => {
    expect(() => new ModelKeyCipher(randomBytes(16))).toThrow(RangeError);
  });

  it("says nothing about the key in its error", () => {
    const sealed = cipher.seal(owner, modelKey);

    sealed.writeUInt8(sealed.readUInt8(sealed.length - 1) ^ 0xff, sealed.length - 1);

    expect(() => cipher.open(owner, sealed)).toThrow(/^A stored Model Key could not be decrypted$/);
  });
});
