import { ProfileSchema, type Profile } from "@helpmegethired/shared";

import { apiUrl } from "../config/api-url";

// The API answered something the page cannot render: an expired session, a Profile that is
// not there, or an error page from a proxy in between.
export class ProfileUnavailableError extends Error {
  constructor(readonly status: number) {
    super(`The API answered the Profile request with ${status}`);
    this.name = "ProfileUnavailableError";
  }
}

export class ProfileClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  get(token: string): Promise<Profile> {
    return this.request("/profile", token, "GET");
  }

  // Clears the review flags and records the confirmation; confirming again changes nothing.
  confirm(token: string): Promise<Profile> {
    return this.request("/profile/confirm", token, "POST");
  }

  private async request(path: string, token: string, method: string): Promise<Profile> {
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new ProfileUnavailableError(response.status);
    }

    return ProfileSchema.parse(await response.json().catch(() => undefined));
  }
}

export const profileClient = new ProfileClient(apiUrl);
