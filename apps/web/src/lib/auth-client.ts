import {
  AccountSchema,
  ApiErrorSchema,
  AuthenticatedAccountSchema,
  type Account,
  type ApiError,
  type AuthenticatedAccount,
  type Credentials,
} from "@helpmegethired/shared";

import { apiUrl } from "../config/api-url";

export type ApiResult<Value> = { ok: true; value: Value } | { ok: false; status: number; message: string };

const UNREADABLE_ERROR = "The API answered with an error that could not be read";

function describe(error: ApiError): string {
  return error.issues?.length ? error.issues.map((issue) => issue.message).join(" ") : error.message;
}

async function failureOf(response: Response): Promise<ApiResult<never>> {
  const parsed = ApiErrorSchema.safeParse(await response.json().catch(() => undefined));

  return { ok: false, status: response.status, message: parsed.success ? describe(parsed.data) : UNREADABLE_ERROR };
}

export class AuthClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  signUp(credentials: Credentials): Promise<ApiResult<AuthenticatedAccount>> {
    return this.authenticate("/auth/sign-up", credentials);
  }

  signIn(credentials: Credentials): Promise<ApiResult<AuthenticatedAccount>> {
    return this.authenticate("/auth/sign-in", credentials);
  }

  async signOut(token: string): Promise<void> {
    await this.request("/auth/sign-out", { method: "POST", headers: this.bearer(token) });
  }

  async currentAccount(token: string): Promise<Account | undefined> {
    const response = await this.request("/auth/account", { headers: this.bearer(token) });

    return response.ok ? AccountSchema.parse(await response.json()) : undefined;
  }

  private async authenticate(path: string, credentials: Credentials): Promise<ApiResult<AuthenticatedAccount>> {
    const response = await this.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    });

    return response.ok
      ? { ok: true, value: AuthenticatedAccountSchema.parse(await response.json()) }
      : failureOf(response);
  }

  private request(path: string, init: RequestInit): Promise<Response> {
    return this.fetchImplementation(`${this.baseUrl}${path}`, { ...init, cache: "no-store" });
  }

  private bearer(token: string): HeadersInit {
    return { authorization: `Bearer ${token}` };
  }
}

export const authClient = new AuthClient(apiUrl);
