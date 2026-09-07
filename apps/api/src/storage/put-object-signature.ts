import type { PutObjectCommandInput } from "@aws-sdk/client-s3";

export const CONTENT_TYPE_HEADER = "content-type";
export const CONTENT_LENGTH_HEADER = "content-length";
export const CHECKSUM_SHA256_HEADER = "x-amz-checksum-sha256";

export const PUT_SIGNED_HEADERS = new Set([CONTENT_TYPE_HEADER, CONTENT_LENGTH_HEADER, CHECKSUM_SHA256_HEADER]);

export const sha256HexToBase64 = (hex: string): string => Buffer.from(hex, "hex").toString("base64");

export function putObjectInput(
  bucket: string,
  key: string,
  size: number,
  sha256: string,
  contentType: string,
): PutObjectCommandInput {
  return {
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    ChecksumSHA256: sha256HexToBase64(sha256),
  };
}

export function uploadHeaders(sha256: string, contentType: string): Record<string, string> {
  return {
    [CONTENT_TYPE_HEADER]: contentType,
    [CHECKSUM_SHA256_HEADER]: sha256HexToBase64(sha256),
  };
}
