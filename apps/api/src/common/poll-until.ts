export interface PollingPlan {
  attempts: number;
  delayMs: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Answers true as soon as the check passes, false once every attempt is used.
export async function pollUntil(check: () => Promise<boolean>, plan: PollingPlan): Promise<boolean> {
  for (let attempt = 1; attempt <= plan.attempts; attempt += 1) {
    if (await check()) {
      return true;
    }

    if (attempt < plan.attempts) {
      await sleep(plan.delayMs);
    }
  }

  return false;
}
