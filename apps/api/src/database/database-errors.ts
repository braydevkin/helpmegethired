const UNIQUE_VIOLATION = "23505";

interface DriverError {
  code?: unknown;
  constraint?: unknown;
}

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const { code, constraint: violated } = error as DriverError;

  return code === UNIQUE_VIOLATION && violated === constraint;
}
