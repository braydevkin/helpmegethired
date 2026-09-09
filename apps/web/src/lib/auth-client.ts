import { AccountSchema, type Account, type AccountInformation } from "@helpmegethired/shared";

import { apiUrl } from "../config/api-url";

export class AuthClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async signOut(token: string): Promise<void> {
    await this.request("/auth/sign-out", { method: "POST", headers: this.bearer(token) });
  }

  async currentAccount(token: string): Promise<Account | undefined> {
    const response = await this.request("/auth/account", { headers: this.bearer(token) });

    return response.ok ? AccountSchema.parse(await response.json()) : undefined;
  }

  async updateAccount(token: string, information: AccountInformation): Promise<Account | undefined> {
    const response = await this.request("/auth/account", {
      method: "PATCH",
      headers: { ...this.bearer(token), "content-type": "application/json" },
      body: JSON.stringify(information),
    });

    return response.ok ? AccountSchema.parse(await response.json()) : undefined;
  }

  private request(path: string, init: RequestInit): Promise<Response> {
    return this.fetchImplementation(`${this.baseUrl}${path}`, { ...init, cache: "no-store" });
  }

  private bearer(token: string): Record<string, string> {
    return { authorization: `Bearer ${token}` };
  }
}

export const authClient = new AuthClient(apiUrl);
