import { describe, expect, it } from "vitest";

import { UnknownSegmentKindError } from "./ingestion-errors";
import { SegmentProcessor } from "./segment-processor";
import { SegmentProcessorRegistry } from "./segment-processor.registry";

class NoopProcessor extends SegmentProcessor<string, string, string> {
  constructor(readonly kind: string) {
    super();
  }

  read(input: string): Promise<string> {
    return Promise.resolve(input);
  }

  recognize(content: string): Promise<string> {
    return Promise.resolve(content);
  }

  save(): Promise<void> {
    return Promise.resolve();
  }
}

describe("SegmentProcessorRegistry", () => {
  it("answers the processor registered for a kind", () => {
    const experience = new NoopProcessor("experience");
    const registry = new SegmentProcessorRegistry([new NoopProcessor("basic-profile"), experience]);

    expect(registry.processorFor("experience")).toBe(experience);
  });

  it("refuses a kind nobody handles", () => {
    const registry = new SegmentProcessorRegistry([]);

    expect(() => registry.processorFor("project")).toThrow(UnknownSegmentKindError);
  });

  it("refuses two processors for the same kind", () => {
    const registry = new SegmentProcessorRegistry([new NoopProcessor("project")]);

    expect(() => registry.register(new NoopProcessor("project"))).toThrow('kind "project"');
  });
});
