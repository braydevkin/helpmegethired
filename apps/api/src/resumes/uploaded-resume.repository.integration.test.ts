import { randomUUID } from "node:crypto";

import type { INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Id } from "@helpmegethired/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EnvironmentModule } from "../config/environment.module";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import { createAccountPair, expectScopedToAccount } from "../database/testing/account-pair";
import { resumeObjectKeyFor } from "./resume-object-key";
import { UploadInFlightError } from "./resume-errors";
import { DuplicateUploadError, UploadedResumeRepository } from "./uploaded-resume.repository";

const sha256Of = (seed: string) => seed.repeat(64).slice(0, 64);

describe("UploadedResumeRepository", () => {
  let context: INestApplicationContext;
  let database: Database;
  let repository: UploadedResumeRepository;

  const newUpload = (accountId: Id, seed = "a") => {
    const id = randomUUID();

    return { id, fileName: "ada.pdf", sizeBytes: 1_024, sha256: sha256Of(seed), objectKey: resumeObjectKeyFor(accountId, id), maxAttempts: 3 };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EnvironmentModule, DatabaseModule],
      providers: [UploadedResumeRepository],
    }).compile();

    context = await moduleRef.init();
    database = context.get(DATABASE);
    repository = context.get(UploadedResumeRepository);
  });

  afterAll(async () => {
    await context.close();
  });

  it("creates a pending record with the object key under the Account's prefix", async () => {
    const { owner } = await createAccountPair(database);
    const upload = newUpload(owner);

    const resume = await repository.create(owner, upload);

    expect(resume).toMatchObject({ id: upload.id, accountId: owner, status: "pending", errorCode: null, ingestionId: null });
    expect(resume.objectKey).toBe(`resumes/${owner}/${upload.id}.pdf`);
  });

  it("refuses a second live record for the same file of the same Account", async () => {
    const { owner, other } = await createAccountPair(database);

    await repository.create(owner, newUpload(owner));

    await expect(repository.create(owner, newUpload(owner))).rejects.toThrow(DuplicateUploadError);
    await expect(repository.create(other, newUpload(other))).resolves.toMatchObject({ accountId: other });
  });

  it("lets one Account hold one upload in flight at a time", async () => {
    const { owner } = await createAccountPair(database);
    const first = await repository.create(owner, newUpload(owner, "a"));
    const second = await repository.create(owner, newUpload(owner, "b"));

    await expect(repository.markUploaded(owner, first.id)).resolves.toMatchObject({ status: "uploaded" });
    await expect(repository.markUploaded(owner, second.id)).rejects.toThrow(UploadInFlightError);
    await expect(repository.markUploaded(owner, first.id)).resolves.toBeUndefined();
  });

  it("lists the Account's records newest first with an optional status filter", async () => {
    const { owner } = await createAccountPair(database);
    const first = await repository.create(owner, newUpload(owner, "a"));
    const second = await repository.create(owner, newUpload(owner, "b"));

    await repository.markUploaded(owner, second.id);

    expect((await repository.list(owner)).map((resume) => resume.id)).toEqual([second.id, first.id]);
    expect((await repository.list(owner, "pending")).map((resume) => resume.id)).toEqual([first.id]);
  });

  it("answers a record of another Account as absent everywhere", async () => {
    const pair = await createAccountPair(database);
    const resume = await repository.create(pair.owner, newUpload(pair.owner));

    await expectScopedToAccount(pair, (account) => repository.findById(account, resume.id));
    await expectScopedToAccount(pair, (account) => repository.findLiveBySha256(account, resume.sha256));
    await expectScopedToAccount(pair, (account) => repository.markUploaded(account, resume.id));
    expect(await repository.list(pair.other)).toEqual([]);
  });
});
