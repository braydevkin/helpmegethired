export function classNames(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}
