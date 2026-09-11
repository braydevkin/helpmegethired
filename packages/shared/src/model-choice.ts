import { z } from "zod";

import { AccountModelChoiceSchema, ModelIdSchema, ProviderSchema, isCataloguePairing } from "./model-catalogue.js";
import { TimestampSchema } from "./primitives.js";

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

export const MODEL_KEY_TICKET_LIFETIME_SECONDS = 60;

// POST /account/model/key-ticket: the web app asks for it with the Session and hands it to the
// page, which presents it to send the key straight to the API, so the key never passes through
// the web app (ADR-0023).
export const ModelKeyTicketSchema = z.object({
  ticket: z.string().regex(/^[\w-]{43}$/),
  expiresAt: TimestampSchema,
});

export type ModelKeyTicket = z.infer<typeof ModelKeyTicketSchema>;

export const ModelChoiceErrorCodeSchema = z.enum([
  "unsupported_model_choice",
  "model_key_invalid",
  "model_key_not_permitted",
  "provider_unavailable",
  "model_key_missing",
  "model_key_ticket_invalid",
]);

export type ModelChoiceErrorCode = z.infer<typeof ModelChoiceErrorCodeSchema>;
