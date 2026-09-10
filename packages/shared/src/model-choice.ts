import { z } from "zod";

import { AccountModelChoiceSchema, ModelIdSchema, ProviderSchema, isCataloguePairing } from "./model-catalogue.js";

export const MODEL_KEY_MIN_LENGTH = 20;
export const MODEL_KEY_MAX_LENGTH = 512;

// PUT /account/model: the choice and the Candidate's own key at that Provider.
export const ModelChoiceRequestSchema = z
  .strictObject({
    provider: ProviderSchema,
    modelId: ModelIdSchema,
    key: z.string().trim().min(MODEL_KEY_MIN_LENGTH).max(MODEL_KEY_MAX_LENGTH),
  })
  .refine(isCataloguePairing, { message: "Only a pairing in the catalogue can be chosen", path: ["modelId"] });

export type ModelChoiceRequest = z.infer<typeof ModelChoiceRequestSchema>;

// GET /account/model: an Account that has not chosen yet answers `null`, not 404, because the
// provider page renders that state.
export const ModelChoiceStateSchema = z.object({
  choice: AccountModelChoiceSchema.nullable(),
});

export type ModelChoiceState = z.infer<typeof ModelChoiceStateSchema>;

export const ModelChoiceErrorCodeSchema = z.enum([
  "unsupported_model_choice",
  "model_key_invalid",
  "model_key_not_permitted",
  "provider_unavailable",
  "model_key_missing",
]);

export type ModelChoiceErrorCode = z.infer<typeof ModelChoiceErrorCodeSchema>;
