const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const ESCAPABLE = /[&<>"']/g;

export class Html {
  constructor(private readonly markup: string) {}

  toString(): string {
    return this.markup;
  }
}

function escape(value: unknown): string {
  if (value instanceof Html) {
    return value.toString();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(ESCAPABLE, (character) => ESCAPES[character] ?? character);
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): Html {
  const markup = strings.reduce((rendered, chunk, index) =>
    index === 0 ? chunk : `${rendered}${escape(values[index - 1])}${chunk}`,
  "");

  return new Html(markup);
}
