const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;

// "1.8 MB", "640 KB": what the file card shows beside the name.
export function formatSize(bytes: number): string {
  if (bytes >= MEGABYTE) {
    return `${(bytes / MEGABYTE).toFixed(1).replace(/\.0$/u, "")} MB`;
  }

  return `${Math.max(1, Math.round(bytes / KILOBYTE))} KB`;
}

export const initialsOf = (name: string | null, lastName: string | null): string =>
  [name, lastName]
    .map((part) => part?.trim().charAt(0).toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "?";
