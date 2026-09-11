import { describe, expect, it } from "vitest";
import { z } from "zod";

import { CurationMetricsSchema } from "./curation-metrics.js";
import { CurationProgressSchema, CurationSchema, CurationUnitSchema } from "./curation.js";
import { AccountModelChoiceSchema, MODEL_CATALOGUE, ModelCatalogueEntrySchema } from "./model-catalogue.js";
import { EvidenceSchema, StatementSchema } from "./statement.js";

describe("MODEL_CATALOGUE", () => {
  it("ships exactly one pairing in phase one: Anthropic with claude-sonnet-5", () => {
    expect(MODEL_CATALOGUE.map(({ provider, modelId }) => [provider, modelId])).toEqual([["anthropic", "claude-sonnet-5"]]);
  });

  it("describes a model with no cost, speed or quality figure", () => {
    expect(MODEL_CATALOGUE.map((entry) => Object.keys(entry).sort())).toEqual([["description", "modelId", "provider", "providerName"]]);
  });
});

describe("ModelCatalogueEntrySchema", () => {
  const entry = MODEL_CATALOGUE[0];

  it.each([
    ["a cost", { ...entry, costPerMillionTokens: 3 }],
    ["a speed figure", { ...entry, tokensPerSecond: 80 }],
    ["a quality rating", { ...entry, depth: "high" }],
    ["a provider phase one does not ship", { ...entry, provider: "openai" }],
    ["a date-suffixed model id", { ...entry, modelId: "claude-sonnet-5-20260101" }],
  ])("rejects an entry with %s", (_label, input) => {
    expect(ModelCatalogueEntrySchema.safeParse(input).success).toBe(false);
  });
});

describe("AccountModelChoiceSchema", () => {
  const choice = { provider: "anthropic", modelId: "claude-sonnet-5", keyStored: true };

  it("accepts the pairing and whether a key is stored", () => {
    expect(AccountModelChoiceSchema.safeParse(choice).success).toBe(true);
  });

  it.each([
    ["the key itself", { ...choice, key: "sk-ant-api03-example" }],
    ["the encrypted key", { ...choice, encryptedKey: "djEwOnNvbWUtY2lwaGVydGV4dA==" }],
    ["the last characters of the key", { ...choice, keyLastFour: "mple" }],
  ])("refuses a choice that carries %s", (_label, input) => {
    expect(AccountModelChoiceSchema.safeParse(input).success).toBe(false);
  });

  it("refuses a model outside the catalogue", () => {
    expect(AccountModelChoiceSchema.safeParse({ ...choice, modelId: "claude-opus-5" }).success).toBe(false);
  });
});

describe("the AI Analysis schemas", () => {
  const propertyNamesOf = (schema: unknown): string[] => {
    if (Array.isArray(schema)) return schema.flatMap(propertyNamesOf);
    if (schema === null || typeof schema !== "object") return [];
    const { properties, ...rest } = schema as { properties?: Record<string, unknown> };
    const own = properties ? Object.keys(properties) : [];
    return [...own, ...Object.values(properties ?? {}).flatMap(propertyNamesOf), ...Object.values(rest).flatMap(propertyNamesOf)];
  };

  it("carry no field for key material", () => {
    const schemas = [
      CurationSchema,
      CurationUnitSchema,
      CurationProgressSchema,
      CurationMetricsSchema,
      StatementSchema,
      EvidenceSchema,
      ModelCatalogueEntrySchema,
      AccountModelChoiceSchema,
    ];
    const names = schemas.flatMap((schema) => propertyNamesOf(z.toJSONSchema(schema)));

    expect(names.filter((name) => /key|secret|token|credential/i.test(name))).toEqual(["keyStored"]);
  });
});
