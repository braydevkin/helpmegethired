import {
  ProfileRecognitionErrorCodeSchema,
  ProfileRecognitionReceiptSchema,
  type ProfileRecognitionErrorCode,
  type ProfileRecognitionReceipt,
} from "@helpmegethired/shared";

import { apiUrl } from "../config/api-url";
import { apiErrorCodeOf, jsonBodyOf } from "./api-response";

export class ProfileRecognitionRefusedError extends Error {
  constructor(
    readonly code: ProfileRecognitionErrorCode | undefined,
    readonly status: number,
  ) {
    super(`The API refused the request with ${status}${code ? ` (${code})` : ""}`);
    this.name = "ProfileRecognitionRefusedError";
  }
}

// Asks the API to read the stored résumé text again with the Candidate's Model; the upload step
// follows the Uploaded Resume it answers.
export class ProfileRecognitionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async start(token: string): Promise<ProfileRecognitionReceipt> {
    const response = await this.fetchImplementation(`${this.baseUrl}/profile/recognition`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body = await jsonBodyOf(response, (refused) => new ProfileRecognitionRefusedError(apiErrorCodeOf(refused, ProfileRecognitionErrorCodeSchema), response.status));

    return ProfileRecognitionReceiptSchema.parse(body);
  }
}

export const profileRecognitionClient = new ProfileRecognitionClient(apiUrl);
