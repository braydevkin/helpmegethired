import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import { StreamTooLongError, readBounded } from "./read-bounded";

const chunks = (...parts: string[]) => Readable.from(parts.map((part) => Buffer.from(part)));

describe("readBounded", () => {
  it("joins the chunks of a stream within the limit", async () => {
    await expect(readBounded(chunks("%PDF", "-1.7"), 8)).resolves.toEqual(Buffer.from("%PDF-1.7"));
  });

  it("refuses a stream one byte over the limit and destroys it", async () => {
    const stream = chunks("%PDF", "-1.7", "\n");

    await expect(readBounded(stream, 8)).rejects.toThrow(StreamTooLongError);
    expect(stream.destroyed).toBe(true);
  });

  it("accepts string chunks", async () => {
    await expect(readBounded(Readable.from(["ab", "c"]), 3)).resolves.toEqual(Buffer.from("abc"));
  });
});
