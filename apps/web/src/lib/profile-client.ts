import {
  ApiErrorSchema,
  ProfileSchema,
  type BasicProfile,
  type Id,
  type Profile,
  type ProfileEntryCorrection,
  type ProfileListPart,
} from "@helpmegethired/shared";

import { apiUrl } from "../config/api-url";

// The API answered something the page cannot render: an expired session, a Profile that is
// not there, or an error page from a proxy in between.
export class ProfileUnavailableError extends Error {
  constructor(readonly status: number) {
    super(`The API answered the Profile request with ${status}`);
    this.name = "ProfileUnavailableError";
  }
}

// The correction did not pass the part's schema. The issues are kept by field, which is where
// the page shows them.
export class ProfileCorrectionRejectedError extends Error {
  constructor(readonly issues: Record<string, string>) {
    super("The correction did not pass the schema of its Profile part");
    this.name = "ProfileCorrectionRejectedError";
  }
}

interface Sent {
  method: string;
  body?: unknown;
}

const issuesOf = (body: unknown): Record<string, string> => {
  const error = ApiErrorSchema.safeParse(body);

  return Object.fromEntries((error.success ? (error.data.issues ?? []) : []).map((issue) => [issue.path, issue.message]));
};

export class ProfileClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  get(token: string): Promise<Profile> {
    return this.request("/profile", token, { method: "GET" });
  }

  // Clears the review flags and records the confirmation; confirming again changes nothing.
  confirm(token: string): Promise<Profile> {
    return this.request("/profile/confirm", token, { method: "POST" });
  }

  correctBasicProfile(token: string, basicProfile: BasicProfile): Promise<Profile> {
    return this.request("/profile/parts/basic-profile", token, { method: "PUT", body: basicProfile });
  }

  addEntry(token: string, part: ProfileListPart, entry: ProfileEntryCorrection): Promise<Profile> {
    return this.request(`/profile/parts/${part}`, token, { method: "POST", body: entry });
  }

  correctEntry(token: string, part: ProfileListPart, entryId: Id, entry: ProfileEntryCorrection): Promise<Profile> {
    return this.request(`/profile/parts/${part}/${entryId}`, token, { method: "PUT", body: entry });
  }

  removeEntry(token: string, part: ProfileListPart, entryId: Id): Promise<Profile> {
    return this.request(`/profile/parts/${part}/${entryId}`, token, { method: "DELETE" });
  }

  private async request(path: string, token: string, sent: Sent): Promise<Profile> {
    const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
      method: sent.method,
      headers: { authorization: `Bearer ${token}`, ...(sent.body === undefined ? {} : { "content-type": "application/json" }) },
      ...(sent.body === undefined ? {} : { body: JSON.stringify(sent.body) }),
      cache: "no-store",
    });

    if (response.status === 400) {
      throw new ProfileCorrectionRejectedError(issuesOf(await response.json().catch(() => undefined)));
    }

    if (!response.ok) {
      throw new ProfileUnavailableError(response.status);
    }

    return ProfileSchema.parse(await response.json().catch(() => undefined));
  }
}

export const profileClient = new ProfileClient(apiUrl);
