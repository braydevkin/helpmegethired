import { Readable } from "node:stream";

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentConfig } from "../config/environment.module";
import { ObjectStorage, type PresignedUpload, type StoredObject } from "./object-storage";
import { CHECKSUM_SHA256_HEADER, PUT_SIGNED_HEADERS, putObjectInput, uploadHeaders } from "./put-object-signature";
import { S3_CLIENTS, type S3Clients } from "./s3-clients";

const MILLISECONDS_PER_SECOND = 1_000;

interface S3Failure {
  name?: string;
  $metadata?: { httpStatusCode?: number };
}

const isAbsent = (error: unknown): boolean => {
  const failure = error as S3Failure;

  return failure.$metadata?.httpStatusCode === 404 || failure.name === "NotFound" || failure.name === "NoSuchKey";
};

@Injectable()
export class S3ObjectStorage extends ObjectStorage {
  private readonly bucket: string;
  private readonly presignExpiresSeconds: number;

  constructor(
    @Inject(S3_CLIENTS) private readonly clients: S3Clients,
    @Inject(ConfigService) config: EnvironmentConfig,
  ) {
    super();
    this.bucket = config.get("S3_BUCKET", { infer: true });
    this.presignExpiresSeconds = config.get("PRESIGN_EXPIRES_SECONDS", { infer: true });
  }

  async presignPut(key: string, size: number, sha256: string, contentType: string): Promise<PresignedUpload> {
    const expiresAt = new Date(Date.now() + this.presignExpiresSeconds * MILLISECONDS_PER_SECOND);
    const command = new PutObjectCommand(putObjectInput(this.bucket, key, size, sha256, contentType));
    const url = await getSignedUrl(this.clients.public, command, {
      expiresIn: this.presignExpiresSeconds,
      signableHeaders: PUT_SIGNED_HEADERS,
      unhoistableHeaders: new Set([CHECKSUM_SHA256_HEADER]),
    });

    return { url, headers: uploadHeaders(sha256, contentType), expiresAt };
  }

  async head(key: string): Promise<StoredObject | undefined> {
    try {
      const { ContentLength } = await this.clients.internal.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return { size: ContentLength ?? 0 };
    } catch (error) {
      if (isAbsent(error)) {
        return undefined;
      }

      throw error;
    }
  }

  async getStream(key: string): Promise<Readable> {
    const { Body } = await this.clients.internal.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));

    if (!(Body instanceof Readable)) {
      throw new Error(`The object ${key} did not answer with a readable body`);
    }

    return Body;
  }

  async delete(key: string): Promise<void> {
    await this.clients.internal.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
