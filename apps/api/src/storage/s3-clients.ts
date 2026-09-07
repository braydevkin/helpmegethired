import { S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentConfig } from "../config/environment.module";
import type { StorageEnvironment } from "../config/environment.schema";

export interface S3Clients {
  internal: S3Client;
  public: S3Client;
}

export const S3_CLIENTS = Symbol("S3_CLIENTS");

function createS3Client(endpoint: string, environment: StorageEnvironment): S3Client {
  return new S3Client({
    endpoint,
    region: environment.S3_REGION,
    credentials: { accessKeyId: environment.S3_ACCESS_KEY, secretAccessKey: environment.S3_SECRET_KEY },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export function createS3Clients(environment: StorageEnvironment): S3Clients {
  return {
    internal: createS3Client(environment.S3_ENDPOINT, environment),
    public: createS3Client(environment.S3_PUBLIC_ENDPOINT, environment),
  };
}

const storageEnvironmentOf = (config: EnvironmentConfig): StorageEnvironment => ({
  S3_ENDPOINT: config.get("S3_ENDPOINT", { infer: true }),
  S3_PUBLIC_ENDPOINT: config.get("S3_PUBLIC_ENDPOINT", { infer: true }),
  S3_BUCKET: config.get("S3_BUCKET", { infer: true }),
  S3_ACCESS_KEY: config.get("S3_ACCESS_KEY", { infer: true }),
  S3_SECRET_KEY: config.get("S3_SECRET_KEY", { infer: true }),
  S3_REGION: config.get("S3_REGION", { infer: true }),
  PRESIGN_EXPIRES_SECONDS: config.get("PRESIGN_EXPIRES_SECONDS", { infer: true }),
});

export const s3ClientsProvider = {
  provide: S3_CLIENTS,
  useFactory: (config: EnvironmentConfig) => createS3Clients(storageEnvironmentOf(config)),
  inject: [ConfigService],
};
