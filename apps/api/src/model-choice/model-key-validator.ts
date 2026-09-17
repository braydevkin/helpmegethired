import type { ModelId, Provider } from "@helpmegethired/shared";

export type ModelKeyVerdict = "valid" | "invalid" | "not_permitted" | "unavailable";

export interface ModelKeyTarget {
  provider: Provider;
  modelId: ModelId;
}

export abstract class ModelKeyValidator {
  abstract validate(target: ModelKeyTarget, modelKey: string): Promise<ModelKeyVerdict>;
}
