import { inspect } from "node:util";

import { describe, expect, it } from "vitest";

import { ModelKey } from "./model-key";

const value = "sk-ant-api03-a-candidate-key-for-the-wrapper";

describe("ModelKey", () => {
  const key = new ModelKey(value);

  it("gives the key only through reveal", () => {
    expect(key.reveal()).toBe(value);
  });

  it("shows a placeholder when logged, serialised, or interpolated", () => {
    expect(JSON.stringify({ key })).toBe('{"key":"[Model Key]"}');
    expect(`${key}`).toBe("[Model Key]");
    expect(inspect({ key })).not.toContain(value);
  });
});
