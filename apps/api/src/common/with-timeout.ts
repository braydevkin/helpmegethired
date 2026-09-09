export class TimeoutError extends Error {
  constructor(action: string, timeoutMs: number) {
    super(`${action} took longer than ${timeoutMs} ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<Result>(work: Promise<Result>, timeoutMs: number, action: string): Promise<Result> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(action, timeoutMs)), timeoutMs);
  });

  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}
