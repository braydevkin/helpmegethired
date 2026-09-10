export const MODEL_KEY_ENCRYPTION_KEY_BYTES = 32;

// Used only when no key is configured, which the environment schema refuses in production, so
// every local stack and test run can store a Model Key without a secret of its own.
export const DEVELOPMENT_MODEL_KEY_ENCRYPTION_KEY = Buffer.from("development-only-model-key-00000");

export const decodeEncryptionKey = (encoded: string): Buffer => Buffer.from(encoded, "base64");

export const modelKeyEncryptionKeyOf = (configured: string | null): Buffer =>
  configured === null ? DEVELOPMENT_MODEL_KEY_ENCRYPTION_KEY : decodeEncryptionKey(configured);
