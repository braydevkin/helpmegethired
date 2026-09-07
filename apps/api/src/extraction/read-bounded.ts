import type { Readable } from "node:stream";

export class StreamTooLongError extends Error {
  constructor(maxBytes: number) {
    super(`The stream is longer than ${maxBytes} bytes`);
    this.name = "StreamTooLongError";
  }
}

// Leaving the loop early destroys the stream, so an oversized object is never read to the end.
export async function readBounded(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;

  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);

    length += bytes.length;

    if (length > maxBytes) {
      throw new StreamTooLongError(maxBytes);
    }

    chunks.push(bytes);
  }

  return Buffer.concat(chunks);
}
