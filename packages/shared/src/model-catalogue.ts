import { z } from "zod";

import { TextSchema, listOf } from "./primitives.js";

export const ProviderSchema = z.enum(["anthropic"]);
export type Provider = z.infer<typeof ProviderSchema>;

export const ModelIdSchema = z.enum(["claude-sonnet-5"]);
export type ModelId = z.infer<typeof ModelIdSchema>;

// Strict, so an entry can never gain a cost, speed or quality figure: none has been measured
// (ADR-0023). The model id is the pin, since no dated snapshot sits underneath it.
export const ModelCatalogueEntrySchema = z.strictObject({
  provider: ProviderSchema,
  providerName: TextSchema,
  modelId: ModelIdSchema,
  description: TextSchema,
});

export type ModelCatalogueEntry = z.infer<typeof ModelCatalogueEntrySchema>;

export const ModelCatalogueSchema = listOf(ModelCatalogueEntrySchema).min(1);
export type ModelCatalogue = z.infer<typeof ModelCatalogueSchema>;

export const MODEL_CATALOGUE: ModelCatalogue = ModelCatalogueSchema.parse([
  {
    provider: "anthropic",
    providerName: "Anthropic",
    modelId: "claude-sonnet-5",
    description: "Claude Sonnet 5, called by the identifier claude-sonnet-5 on every request.",
  },
]);

export const isCataloguePairing = ({ provider, modelId }: { provider: Provider; modelId: ModelId }): boolean =>
  MODEL_CATALOGUE.some((entry) => entry.provider === provider && entry.modelId === modelId);

// Strict, so an object that still carries the Model Key is refused instead of being passed on
// without it; what the Candidate sees is only whether a key is stored.
export const AccountModelChoiceSchema = z
  .strictObject({
    provider: ProviderSchema,
    modelId: ModelIdSchema,
    keyStored: z.boolean(),
  })
  .refine(isCataloguePairing, { message: "Only a pairing in the catalogue can be chosen", path: ["modelId"] });

export type AccountModelChoice = z.infer<typeof AccountModelChoiceSchema>;
