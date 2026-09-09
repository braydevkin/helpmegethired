import type { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { StorageModule } from "./storage.module";

describe("StorageModule", () => {
  it("destroys both S3 clients when the application shuts down", () => {
    const internal = { destroy: vi.fn() } as unknown as S3Client;
    const external = { destroy: vi.fn() } as unknown as S3Client;

    new StorageModule({ internal, public: external }).onApplicationShutdown();

    expect(internal.destroy).toHaveBeenCalledOnce();
    expect(external.destroy).toHaveBeenCalledOnce();
  });
});
