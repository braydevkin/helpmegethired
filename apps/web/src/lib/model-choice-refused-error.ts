import { ModelChoiceErrorCodeSchema, type ModelChoiceErrorCode } from "@helpmegethired/shared";

import { apiErrorCodeOf } from "./api-response";

// A refusal the API explains with one of the shared codes, such as a key the Provider does not accept.
export class ModelChoiceRefusedError extends Error {
  constructor(
    readonly code: ModelChoiceErrorCode | undefined,
    readonly status: number,
  ) {
    super(`The API refused the request with ${status}${code ? ` (${code})` : ""}`);
    this.name = "ModelChoiceRefusedError";
  }
}

export const modelChoiceRefusalOf =
  (response: Response) =>
  (body: unknown): ModelChoiceRefusedError =>
    new ModelChoiceRefusedError(apiErrorCodeOf(body, ModelChoiceErrorCodeSchema), response.status);
