const FIRST_DELAY_MS = 1_000;
const MAX_DELAY_MS = 10_000;

// 1 s, 2 s, 4 s, 8 s, then 10 s for every later poll.
export const pollDelayMs = (attempt: number): number => Math.min(FIRST_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
