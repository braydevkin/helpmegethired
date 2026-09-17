import type { Provider } from "@helpmegethired/shared";

export interface ProviderLinks {
  keyConsole: string;
  terms: string;
}

export const PROVIDER_LINKS: Record<Provider, ProviderLinks> = {
  anthropic: {
    keyConsole: "https://console.anthropic.com/settings/keys",
    terms: "https://www.anthropic.com/legal/commercial-terms",
  },
};
