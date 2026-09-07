import type { Readable } from "node:stream";

export interface PresignedUpload {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface StoredObject {
  size: number;
}

export interface ListedObject {
  key: string;
  lastModified: Date;
}

export abstract class ObjectStorage {
  abstract presignPut(key: string, size: number, sha256: string, contentType: string): Promise<PresignedUpload>;
  abstract head(key: string): Promise<StoredObject | undefined>;
  abstract getStream(key: string): Promise<Readable>;
  abstract delete(key: string): Promise<void>;
  // One page of the store at a time, so a bucket of any size is walked in bounded memory.
  abstract list(prefix: string): AsyncIterable<ListedObject[]>;
}
