import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { PasswordHasher } from "./password-hasher";

const ALGORITHM = "scrypt";
const SEPARATOR = "$";
const SALT_BYTES = 16;
const KEY_BYTES = 64;

interface ScryptParameters {
  cost: number;
  blockSize: number;
  parallelization: number;
}

const CURRENT_PARAMETERS: ScryptParameters = { cost: 2 ** 15, blockSize: 8, parallelization: 1 };

function memoryLimitFor({ cost, blockSize }: ScryptParameters): number {
  return 256 * cost * blockSize;
}

function deriveKey(password: string, salt: Buffer, parameters: ScryptParameters): Promise<Buffer> {
  const options: ScryptOptions = {
    N: parameters.cost,
    r: parameters.blockSize,
    p: parameters.parallelization,
    maxmem: memoryLimitFor(parameters),
  };

  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_BYTES, options, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

interface StoredHash {
  parameters: ScryptParameters;
  salt: Buffer;
  key: Buffer;
}

function parseStoredHash(hash: string): StoredHash | undefined {
  const [algorithm, cost, blockSize, parallelization, salt, key, ...rest] = hash.split(SEPARATOR);

  if (algorithm !== ALGORITHM || rest.length > 0 || !cost || !blockSize || !parallelization || !salt || !key) {
    return undefined;
  }

  const parameters = { cost: Number(cost), blockSize: Number(blockSize), parallelization: Number(parallelization) };

  if (!Object.values(parameters).every(Number.isSafeInteger)) {
    return undefined;
  }

  return { parameters, salt: Buffer.from(salt, "base64"), key: Buffer.from(key, "base64") };
}

@Injectable()
export class ScryptPasswordHasher extends PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await deriveKey(password, salt, CURRENT_PARAMETERS);
    const { cost, blockSize, parallelization } = CURRENT_PARAMETERS;

    return [ALGORITHM, cost, blockSize, parallelization, salt.toString("base64"), key.toString("base64")].join(
      SEPARATOR,
    );
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const stored = parseStoredHash(hash);

    if (!stored) {
      return false;
    }

    const key = await deriveKey(password, stored.salt, stored.parameters);

    return key.length === stored.key.length && timingSafeEqual(key, stored.key);
  }
}
