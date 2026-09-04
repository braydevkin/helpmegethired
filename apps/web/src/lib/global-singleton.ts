const REGISTRY_KEY = Symbol.for("helpmegethired.singletons");

type Registry = Map<string, unknown>;

type GlobalWithRegistry = typeof globalThis & { [REGISTRY_KEY]?: Registry };

// Next.js evaluates a server module once per route bundle and again on every
// development reload, so a plain module-level instance would be created many
// times per process. The registry keeps exactly one per key.
export function globalSingleton<Value>(key: string, create: () => Value): Value {
  const registry = ((globalThis as GlobalWithRegistry)[REGISTRY_KEY] ??= new Map());

  if (!registry.has(key)) {
    registry.set(key, create());
  }

  return registry.get(key) as Value;
}
