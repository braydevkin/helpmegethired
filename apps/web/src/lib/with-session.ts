import { readSessionToken } from "./session-cookie";

export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Sign in again to continue.";

export interface ActionFailure {
  ok: false;
  message: string;
}

export type ActionResult<Value, Failure extends ActionFailure = ActionFailure> = { ok: true; value: Value } | Failure;

// A missing session reads the same on every journey step; turning a refusal into words stays
// with each action, since only it knows which codes have their own copy.
export async function withSession<Value, Failure extends ActionFailure>(
  work: (token: string) => Promise<Value>,
  failureOf: (error: unknown) => Failure,
): Promise<ActionResult<Value, Failure | ActionFailure>> {
  const token = await readSessionToken();

  if (!token) {
    return { ok: false, message: SESSION_EXPIRED_MESSAGE };
  }

  try {
    return { ok: true, value: await work(token) };
  } catch (error) {
    return failureOf(error);
  }
}
