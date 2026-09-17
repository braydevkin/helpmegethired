import { AccountModelChoiceSchema, type AccountModelChoice, type ModelChoiceRequest } from "@helpmegethired/shared";

import { jsonBodyOf } from "./api-response";
import { modelChoiceRefusalOf } from "./model-choice-refused-error";

// Runs in the browser: the key goes straight to the API under a single-use Model Key ticket,
// with no cookies, and never through the web app (ADR-0023).
export async function sendModelKey(
  apiPublicUrl: string,
  ticket: string,
  request: ModelChoiceRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<AccountModelChoice> {
  const response = await fetchImplementation(`${apiPublicUrl}/account/model`, {
    method: "PUT",
    headers: { authorization: `Bearer ${ticket}`, "content-type": "application/json" },
    body: JSON.stringify(request),
    credentials: "omit",
    cache: "no-store",
  });

  return AccountModelChoiceSchema.parse(await jsonBodyOf(response, modelChoiceRefusalOf(response)));
}
