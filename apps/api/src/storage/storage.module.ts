import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";

import { ObjectStorage } from "./object-storage";
import { S3_CLIENTS, s3ClientsProvider, type S3Clients } from "./s3-clients";
import { S3ObjectStorage } from "./s3-object-storage";

@Module({
  providers: [s3ClientsProvider, { provide: ObjectStorage, useClass: S3ObjectStorage }],
  exports: [ObjectStorage],
})
export class StorageModule implements OnApplicationShutdown {
  constructor(@Inject(S3_CLIENTS) private readonly clients: S3Clients) {}

  onApplicationShutdown(): void {
    this.clients.internal.destroy();
    this.clients.public.destroy();
  }
}
