import { describe, expect, it } from "vitest";

import { ScryptPasswordHasher } from "./scrypt-password-hasher";

const hasher = new ScryptPasswordHasher();
const password = "correct horse battery staple";

describe("ScryptPasswordHasher", () => {
  it("produces a self-describing hash that never contains the password", async () => {
    const hash = await hasher.hash(password);

    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(hash).not.toContain(password);
  });

  it("salts every hash so the same password hashes differently", async () => {
    expect(await hasher.hash(password)).not.toBe(await hasher.hash(password));
  });

  it("verifies the password that produced the hash and rejects any other", async () => {
    const hash = await hasher.hash(password);

    expect(await hasher.verify(password, hash)).toBe(true);
    expect(await hasher.verify("correct horse battery stapler", hash)).toBe(false);
    expect(await hasher.verify("", hash)).toBe(false);
  });

  it.each([
    ["an empty string", ""],
    ["another algorithm", "bcrypt$10$abc$def"],
    ["missing fields", "scrypt$32768$8"],
    ["non-numeric parameters", "scrypt$many$8$1$c2FsdA==$a2V5"],
    ["a trailing field", "scrypt$32768$8$1$c2FsdA==$a2V5$extra"],
  ])("rejects a stored hash with %s instead of throwing", async (_label, hash) => {
    expect(await hasher.verify(password, hash)).toBe(false);
  });
});
