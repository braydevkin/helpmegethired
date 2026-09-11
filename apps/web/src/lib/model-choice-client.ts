import {
  AccountModelChoiceSchema,
  ModelChoiceStateSchema,
  ModelKeyTicketSchema,
  type AccountModelChoice,
  type ModelChoiceState,
  type ModelKeyTicket,
} from "@helpmegethired/shared";

import { apiUrl } from "../config/api-url";
import { jsonBodyOf } from "./api-response";
import { modelChoiceRefusalOf } from "./model-choice-refused-error";

// Everything about the Model Choice except the key itself, which the page sends to the API with
// a ticket so it never passes through the web app (ADR-0023).
export class ModelChoiceClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async read(token: string): Promise<ModelChoiceState> {
    return ModelChoiceStateSchema.parse(await this.request("/account/model", token, "GET"));
  }

  async issueKeyTicket(token: string): Promise<ModelKeyTicket> {
    return ModelKeyTicketSchema.parse(await this.request("/account/model/key-ticket", token, "POST"));
  }

  async revokeKey(token: string): Promise<AccountModelChoice> {
    return AccountModelChoiceSchema.parse(await this.request("/account/model/key", token, "DELETE"));
  }

  private async request(path: string, token: string, method: string): Promise<unknown> {
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    return jsonBodyOf(response, modelChoiceRefusalOf(response));
  }
}

export const modelChoiceClient = new ModelChoiceClient(apiUrl);
