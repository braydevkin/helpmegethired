import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BadRequestException, type INestApplicationContext } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ProfileSchema, SESSION_LIFETIME_SECONDS, type Id, type Profile } from "@helpmegethired/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppModule } from "../app.module";
import { AccountRepository } from "../auth/account.repository";
import { SessionRepository } from "../auth/session.repository";
import { hashSessionToken } from "../auth/session-token";
import { EnvironmentModule } from "../config/environment.module";
import { DATABASE, type Database } from "../database/database";
import { DatabaseModule } from "../database/database.module";
import { createAccountPair, expectScopedToAccount } from "../database/testing/account-pair";
import { ExtractionHandover } from "../extraction/extraction-handover";
import { UploadedResumeRunRepository } from "../extraction/uploaded-resume-run.repository";
import { asJson } from "../ingestion/ingestion.mapper";
import { IngestionQueue, type IngestionJob } from "../ingestion/ingestion-queue";
import { IngestionRunRepository } from "../ingestion/ingestion-run.repository";
import { IngestionRepository } from "../ingestion/ingestion.repository";
import { IngestionRunner } from "../ingestion/ingestion.runner";
import { IngestionService, MAX_ATTEMPTS } from "../ingestion/ingestion.service";
import { SegmentProcessorRegistry } from "../ingestion/segment-processor.registry";
import { QUEUE_PREFIX } from "../queue/queues";
import { resumeObjectKeyFor } from "../resumes/resume-object-key";
import { UploadedResumeRepository } from "../resumes/uploaded-resume.repository";
import { EXTRACTION_MAX_ATTEMPTS } from "../resumes/uploaded-resume.service";
import { ProfileCorrectionService } from "./profile-correction.service";
import { ProfileIngestionModule } from "./profile-ingestion.module";
import { ProfileRepository } from "./profile.repository";
import { ProfileService } from "./profile.service";

const corpus = join(__dirname, "../../test/fixtures/resumes/corpus");
const fixture = (slug: string) => readFileSync(join(corpus, `${slug}.txt`), "utf8");

class RecordingQueue extends IngestionQueue {
  readonly jobs: IngestionJob[] = [];

  enqueue(job: IngestionJob): Promise<void> {
    this.jobs.push(job);

    return Promise.resolve();
  }

  work(): Promise<void> {
    return Promise.resolve();
  }

  hasPendingJob(ingestionId: Id): Promise<boolean> {
    return Promise.resolve(this.jobs.some((job) => job.ingestionId === ingestionId));
  }
}

const PROFILE_TABLES = ["basic_profiles", "experiences", "education", "projects", "skills", "languages", "certifications"] as const;

describe("profile built by Segments", () => {
  let context: INestApplicationContext;
  let database: Database;
  let accounts: AccountRepository;
  let uploads: UploadedResumeRepository;
  let runs: UploadedResumeRunRepository;
  let handover: ExtractionHandover;
  let runner: IngestionRunner;
  let ingestions: IngestionRepository;
  let ingestionRuns: IngestionRunRepository;
  let ingestionService: IngestionService;
  let registry: SegmentProcessorRegistry;
  let profiles: ProfileService;
  let corrections: ProfileCorrectionService;
  let repository: ProfileRepository;
  let queue: RecordingQueue;

  beforeAll(async () => {
    queue = new RecordingQueue();

    const moduleRef = await Test.createTestingModule({ imports: [EnvironmentModule, DatabaseModule, ProfileIngestionModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .overrideProvider(IngestionQueue)
      .useValue(queue)
      .compile();

    context = await moduleRef.init();
    database = context.get(DATABASE);
    accounts = context.get(AccountRepository);
    uploads = context.get(UploadedResumeRepository);
    runs = context.get(UploadedResumeRunRepository);
    handover = context.get(ExtractionHandover);
    runner = context.get(IngestionRunner);
    ingestions = context.get(IngestionRepository);
    ingestionRuns = context.get(IngestionRunRepository);
    ingestionService = context.get(IngestionService);
    registry = context.get(SegmentProcessorRegistry);
    profiles = context.get(ProfileService);
    corrections = context.get(ProfileCorrectionService);
    repository = context.get(ProfileRepository);
  });

  afterAll(async () => {
    await context.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const newAccount = async (): Promise<Id> => (await accounts.create({ email: `${randomUUID()}@candidate.example` })).id;

  // An Uploaded Resume as the extraction processor leaves it before the hand-over: processing,
  // with its text stored.
  const extracted = async (accountId: Id, slug: string) => {
    const id = randomUUID();

    await uploads.create(accountId, {
      id,
      fileName: `${slug}.pdf`,
      sizeBytes: 1024,
      sha256: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      objectKey: resumeObjectKeyFor(accountId, id),
      maxAttempts: EXTRACTION_MAX_ATTEMPTS,
    });
    await uploads.markUploaded(accountId, id);
    await runs.beginAttempt(id);

    return runs.saveText(id, { text: fixture(slug), extractorVersion: "pdftotext/test" });
  };

  const handedOver = async (accountId: Id, slug: string) => {
    const record = await extracted(accountId, slug);

    await handover.handOver(record);

    const linked = await runs.findById(record.id);

    if (!linked?.ingestionId) {
      throw new Error("The hand-over did not link an Ingestion");
    }

    return { record: linked, ingestionId: linked.ingestionId };
  };

  const built = async (accountId: Id, slug: string): Promise<{ profile: Profile; ingestionId: Id; uploadedResumeId: Id }> => {
    const { record, ingestionId } = await handedOver(accountId, slug);

    await runner.run(ingestionId);

    return { profile: await profiles.get(accountId), ingestionId, uploadedResumeId: record.id };
  };

  const statusesOf = async (ingestionId: Id) => (await ingestionRuns.segmentsOf(ingestionId)).map((segment) => segment.status);

  describe("hand-over", () => {
    it("creates the Ingestion from the sections, links it to the record, and enqueues it once", async () => {
      const accountId = await newAccount();
      const { record, ingestionId } = await handedOver(accountId, "ada-single-column-en");

      expect(record.status).toBe("processing");
      expect(await ingestions.findById(accountId, ingestionId)).toMatchObject({ source: "upload", status: "queued" });
      expect((await ingestionRuns.segmentsOf(ingestionId)).map((segment) => segment.kind)).toEqual([
        "header",
        "experience",
        "experience",
        "education",
        "project",
        "skills",
        "languages",
        "certifications",
      ]);
      expect(queue.jobs.filter((job) => job.ingestionId === ingestionId)).toHaveLength(1);

      await handover.handOver(record);

      expect(queue.jobs.filter((job) => job.ingestionId === ingestionId)).toHaveLength(1);
    });
  });

  describe("a fixture resume", () => {
    it("produces the Profile rows, the Progress rising as each Step completes, and marks the record done", async () => {
      const accountId = await newAccount();
      const { ingestionId } = await handedOver(accountId, "ada-single-column-en");
      const seen: number[] = [];
      const recordStep = ingestionRuns.recordStep.bind(ingestionRuns);

      vi.spyOn(ingestionRuns, "recordStep").mockImplementation(async (...arguments_) => {
        const segment = await recordStep(...arguments_);

        seen.push((await ingestionService.progressOf(accountId, ingestionId)).percentage);

        return segment;
      });

      await runner.run(ingestionId);

      const profile = await profiles.get(accountId);

      expect(seen).toEqual([...seen].sort((left, right) => left - right));
      expect(seen.at(-1)).toBe(100);
      expect(ProfileSchema.parse(profile)).toEqual(profile);
      expect(profile.basicProfile).toEqual({
        headline: "Senior Backend Engineer",
        summary: expect.stringContaining("Backend engineer with ten years"),
        linkedinUrl: "https://linkedin.com/in/ada-lovelace-example",
        githubUrl: "https://github.com/ada-example",
      });
      expect(profile.experiences.map((experience) => [experience.role, experience.company, experience.period?.start, experience.skills])).toEqual([
        ["Senior Backend Engineer", "Analytical Engines Ltd", "2021-03", []],
        ["Backend Engineer", "Difference Works", "2016-06", ["TypeScript", "PostgreSQL"]],
      ]);
      expect(profile.education.map((entry) => [entry.institution, entry.degree, entry.fieldOfStudy])).toEqual([
        ["University of Cambridge", "MSc", "Computer Science"],
        ["University of Leeds", "BSc", "Mathematics"],
      ]);
      expect(profile.projects).toMatchObject([{ name: "Difference Engine", url: "https://github.com/ada-example/difference-engine" }]);
      expect(profile.skills.map((skill) => skill.name)).toContain("Node.js");
      expect(profile.languages.map((language) => [language.name, language.level])).toEqual([
        ["English", "Native"],
        ["French", "Intermediate (B1)"],
      ]);
      expect(profile.certifications).toMatchObject([{ name: "AWS Solutions Architect Associate", issuer: "Amazon Web Services", year: 2023 }]);
      expect(profile.yearsOfExperience).toBeGreaterThanOrEqual(9);
      expect(profile.source).toMatchObject({ kind: "upload", fileName: "ada-single-column-en.pdf", ingestionId });
      expect(profile.confirmedAt).toBeNull();
      expect(await runs.findById((await uploads.findByIngestionId(accountId, ingestionId))!.id)).toMatchObject({ status: "done" });
    });

    it("never writes the name, the e-mail, or the phone into a Profile table", async () => {
      const accountId = await newAccount();

      await built(accountId, "ada-single-column-en");

      for (const table of PROFILE_TABLES) {
        const rows = await database.selectFrom(table).selectAll().where("account_id", "=", accountId).execute();
        const text = JSON.stringify(rows);

        expect(text).not.toContain("Ada Lovelace");
        expect(text).not.toContain("ada.lovelace@example.com");
        expect(text).not.toContain("7946 0958");
      }
    });

    it("flags an e-mail that differs from the Account's and a low-confidence field", async () => {
      const accountId = await newAccount();
      const { profile } = await built(accountId, "grace-two-columns-en");

      expect(profile.reviewFlags).toContainEqual({ part: "basicProfile", entry: null, field: "email", reason: "account_mismatch" });
      expect(profile.reviewFlags.some((flag) => flag.reason === "low_confidence")).toBe(true);
    });
  });

  describe("resuming", () => {
    it("continues at the save of the third Segment after a crash following its recognize, redoing no earlier Segment", async () => {
      const accountId = await newAccount();
      const { ingestionId } = await handedOver(accountId, "ada-single-column-en");
      const experiences = registry.processorFor("experience");
      const originalSave = experiences.save.bind(experiences);
      const read = vi.spyOn(experiences, "read");
      const recognize = vi.spyOn(experiences, "recognize");
      let crashed = false;
      const save = vi.spyOn(experiences, "save").mockImplementation((recognized, segmentContext) => {
        if (segmentContext.position === 2 && !crashed) {
          crashed = true;

          return Promise.reject(new Error("worker killed after recognize"));
        }

        return originalSave(recognized, segmentContext);
      });

      await expect(runner.run(ingestionId)).rejects.toThrow("worker killed after recognize");

      expect(await statusesOf(ingestionId)).toEqual(["saved", "saved", "recognized", "pending", "pending", "pending", "pending", "pending"]);

      await runner.run(ingestionId);

      expect(await statusesOf(ingestionId)).toEqual(["saved", "saved", "saved", "saved", "saved", "saved", "saved", "saved"]);
      expect(read).toHaveBeenCalledTimes(2);
      expect(recognize).toHaveBeenCalledTimes(2);
      expect(save).toHaveBeenCalledTimes(3);
      expect((await profiles.get(accountId)).experiences).toHaveLength(2);
    });
  });

  describe("replace by source", () => {
    const otherSourceRow = async (accountId: Id) => {
      const ingestion = await ingestionService.start({ accountId, source: "linkedin", segments: [] });

      await runner.run(ingestion.id);

      const [segment] = await database
        .insertInto("ingestion_segments")
        .values({ ingestion_id: ingestion.id, position: 0, kind: "linkedin-experience", input: "{}", content: null, recognized: null, last_error: null })
        .returningAll()
        .execute();

      await repository.saveExperiences(
        { ingestionId: ingestion.id, accountId, segmentId: segment!.id, position: 0 },
        [{ role: { value: "Kept from LinkedIn", confidence: "high" }, company: null, period: null, description: null, skills: [] }],
      );

      return ingestion.id;
    };

    it("deletes the previous resume's rows once the new Ingestion completes and keeps another source's rows", async () => {
      const accountId = await newAccount();
      const first = await built(accountId, "ada-single-column-en");
      const linkedinIngestionId = await otherSourceRow(accountId);

      await profiles.confirm(accountId);

      const second = await built(accountId, "kenji-single-column-en");

      expect(second.profile.source?.ingestionId).toBe(second.ingestionId);
      expect(second.profile.basicProfile.headline).not.toBe(first.profile.basicProfile.headline);
      expect(second.profile.confirmedAt).toBeNull();
      expect(await repository.rowsOf(accountId, first.ingestionId)).toMatchObject({ basicProfile: undefined, experiences: [], skills: [] });
      expect((await repository.rowsOf(accountId, linkedinIngestionId)).experiences.map((experience) => experience.role)).toEqual(["Kept from LinkedIn"]);
    });

    it("leaves the previous Profile readable when the re-upload's Ingestion fails, and fails the record with profile_build_failed", async () => {
      const accountId = await newAccount();
      const first = await built(accountId, "ada-single-column-en");
      const { record, ingestionId } = await handedOver(accountId, "kenji-single-column-en");
      const header = registry.processorFor("header");

      vi.spyOn(header, "read").mockRejectedValue(new Error("storage unreachable"));

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        await expect(runner.run(ingestionId)).rejects.toThrow("storage unreachable");
      }

      expect(await ingestions.findById(accountId, ingestionId)).toMatchObject({ status: "failed" });
      expect(await runs.findById(record.id)).toMatchObject({ status: "failed" });
      expect((await database.selectFrom("uploaded_resumes").select("error_code").where("id", "=", record.id).executeTakeFirst())?.error_code).toBe(
        "profile_build_failed",
      );
      expect(await profiles.get(accountId)).toMatchObject({
        source: { ingestionId: first.ingestionId },
        basicProfile: first.profile.basicProfile,
        experiences: first.profile.experiences,
      });
    });
  });

  describe("confirm", () => {
    it("clears the review flags, records the time once, and is idempotent", async () => {
      const accountId = await newAccount();
      const { profile } = await built(accountId, "grace-two-columns-en");

      expect(profile.reviewFlags.length).toBeGreaterThan(0);

      const confirmed = await profiles.confirm(accountId);
      const again = await profiles.confirm(accountId);

      expect(confirmed.reviewFlags).toEqual([]);
      expect(confirmed.confirmedAt).toEqual(expect.any(String));
      expect(again.confirmedAt).toBe(confirmed.confirmedAt);
      expect((await profiles.get(accountId)).reviewFlags).toEqual([]);
    });

    it("refuses to confirm an Account with no Profile built", async () => {
      await expect(profiles.confirm(await newAccount())).rejects.toThrow("has no Profile built yet");
    });
  });

  describe("corrections", () => {
    const first = <Entry>(entries: readonly Entry[], what: string): Entry => {
      const [entry] = entries;

      if (!entry) {
        throw new Error(`The fixture produced no ${what} to correct`);
      }

      return entry;
    };

    // No corpus résumé is recognized badly enough to flag an entry, so the flag is put where a
    // hesitant recognition would have left it: on the Segment's own output.
    const flagFirstExperience = async (ingestionId: Id): Promise<void> => {
      const segment = first(
        (await ingestionRuns.segmentsOf(ingestionId)).filter((candidate) => candidate.kind === "experience"),
        "Experience Segment",
      );
      const recognized = structuredClone(segment.recognized) as { experiences: { role: { confidence: string } }[] };

      recognized.experiences[0]!.role.confidence = "low";

      await database.updateTable("ingestion_segments").set({ recognized: asJson(recognized) }).where("id", "=", segment.id).execute();
    };

    it("corrects the Basic Profile, counts it as the Candidate's own, and drops the flags that name no entry", async () => {
      const accountId = await newAccount();
      const { profile } = await built(accountId, "grace-two-columns-en");

      expect(profile.reviewFlags.some((flag) => flag.entry === null)).toBe(true);

      const corrected = await corrections.correctBasicProfile(accountId, {
        headline: "Distributed systems engineer",
        summary: profile.basicProfile.summary,
        linkedinUrl: profile.basicProfile.linkedinUrl,
        githubUrl: profile.basicProfile.githubUrl,
      });

      expect(corrected.basicProfile.headline).toBe("Distributed systems engineer");
      expect(corrected.corrections.basicProfile).toBe(true);
      expect(corrected.reviewFlags.some((flag) => flag.entry === null)).toBe(false);
    });

    it("stops flagging an Experience the Candidate has corrected, and keeps the flags of the others", async () => {
      const accountId = await newAccount();
      const { ingestionId } = await built(accountId, "ada-single-column-en");

      await flagFirstExperience(ingestionId);

      const flagged = await profiles.get(accountId);
      const entry = first(flagged.experiences, "Experience");
      const { id, ...correction } = entry;

      expect(flagged.reviewFlags).toContainEqual({ part: "experience", entry: entry.role, field: "role", reason: "low_confidence" });

      const corrected = await corrections.replaceEntry(accountId, "experiences", id, { ...correction, role: "Staff Backend Engineer" });

      expect(corrected.experiences.map((experience) => experience.role)).toContain("Staff Backend Engineer");
      expect(corrected.reviewFlags.some((flag) => flag.part === "experience")).toBe(false);
      expect(corrected.corrections.entryIds).toContain(id);
      expect(corrected.reviewFlags).toEqual(flagged.reviewFlags.filter((flag) => flag.part !== "experience"));
    });

    it("keeps the place of a corrected entry in its part", async () => {
      const accountId = await newAccount();
      const { profile } = await built(accountId, "ada-single-column-en");
      const order = profile.experiences.map((experience) => experience.id);
      const { id, ...correction } = first(profile.experiences, "Experience");

      const corrected = await corrections.replaceEntry(accountId, "experiences", id, { ...correction, company: "Northwind Labs" });

      expect(corrected.experiences.map((experience) => experience.id)).toEqual(order);
    });

    it("adds an entry the résumé never held at the end of its part, as the Candidate's own", async () => {
      const accountId = await newAccount();
      const { profile } = await built(accountId, "ada-single-column-en");

      const withEntry = await corrections.addEntry(accountId, "languages", { name: "Portuguese", level: "Native" });
      const added = withEntry.languages.at(-1);

      expect(withEntry.languages).toHaveLength(profile.languages.length + 1);
      expect(added).toMatchObject({ name: "Portuguese", level: "Native" });
      expect(withEntry.corrections.entryIds).toContain(added?.id);
    });

    it("removes an entry the recognition should not have written", async () => {
      const accountId = await newAccount();
      const { profile } = await built(accountId, "ada-single-column-en");
      const removed = first(profile.skills, "Skill");

      const left = await corrections.removeEntry(accountId, "skills", removed.id);

      expect(left.skills.map((skill) => skill.id)).not.toContain(removed.id);
      expect(left.skills).toHaveLength(profile.skills.length - 1);
    });

    it("refuses an entry that breaks its part's schema and writes nothing", async () => {
      const accountId = await newAccount();
      const { profile } = await built(accountId, "ada-single-column-en");

      await expect(corrections.addEntry(accountId, "languages", { name: "" })).rejects.toBeInstanceOf(BadRequestException);
      expect((await profiles.get(accountId)).languages).toHaveLength(profile.languages.length);
    });

    it("answers another Account's entry as absent and leaves it untouched", async () => {
      const pair = await createAccountPair(database);
      const { profile } = await built(pair.owner, "ada-single-column-en");
      const entry = first(profile.experiences, "Experience");

      await expect(corrections.removeEntry(pair.other, "experiences", entry.id)).rejects.toThrow(/has no Profile built yet/);
      expect((await profiles.get(pair.owner)).experiences.map((experience) => experience.id)).toContain(entry.id);
    });

    it("answers an entry of another part as absent", async () => {
      const accountId = await newAccount();
      const { profile } = await built(accountId, "ada-single-column-en");

      await expect(corrections.removeEntry(accountId, "projects", first(profile.experiences, "Experience").id)).rejects.toThrow(/No projects entry/);
    });

    it("takes no correction once the Profile is confirmed", async () => {
      const accountId = await newAccount();
      const { profile } = await built(accountId, "ada-single-column-en");

      await profiles.confirm(accountId);

      await expect(corrections.removeEntry(accountId, "skills", first(profile.skills, "Skill").id)).rejects.toThrow(/takes no more corrections/);
    });

    it("loses the corrections to the next Ingestion, which writes the Profile again", async () => {
      const accountId = await newAccount();

      await built(accountId, "ada-single-column-en");
      await corrections.addEntry(accountId, "languages", { name: "Portuguese", level: "Native" });

      const { profile } = await built(accountId, "ada-single-column-en");

      expect(profile.languages.map((language) => language.name)).not.toContain("Portuguese");
      expect(profile.corrections).toEqual({ basicProfile: false, entryIds: [] });
    });
  });

  describe("Account scoping", () => {
    it("answers an empty Profile before any Ingestion and never another Account's rows", async () => {
      const pair = await createAccountPair(database);
      const { ingestionId } = await built(pair.owner, "ada-single-column-en");

      expect(await profiles.get(pair.other)).toMatchObject({ accountId: pair.other, source: null, experiences: [], yearsOfExperience: 0 });
      await expectScopedToAccount(pair, async (account) => (await repository.rowsOf(account, ingestionId)).basicProfile);
      await expectScopedToAccount(pair, (account) => repository.confirm(account, ingestionId));
      await expectScopedToAccount(pair, (account) => ingestions.findLatestCompleted(account, "upload"));
      await expectScopedToAccount(pair, async (account) => (await ingestions.segmentsOf(account, ingestionId))[0]);
      await expectScopedToAccount(pair, (account) => uploads.findByIngestionId(account, ingestionId));
    });
  });
});

describe("profile endpoints", () => {
  let app: import("@nestjs/common").INestApplication;
  let baseUrl: string;
  let accounts: AccountRepository;
  let sessions: SessionRepository;

  const request = (method: string, path: string, token: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const openSession = async (): Promise<{ accountId: string; token: string }> => {
    const account = await accounts.create({ email: `${randomUUID()}@candidate.example` });
    const token = randomUUID();

    await sessions.create({
      accountId: account.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000),
    });

    return { accountId: account.id, token };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(QUEUE_PREFIX)
      .useValue(`test-${randomUUID()}`)
      .compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
    accounts = app.get(AccountRepository);
    sessions = app.get(SessionRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  it("answers the empty Profile of a new Account, valid against the schema", async () => {
    const { accountId, token } = await openSession();

    const response = await request("GET", "/profile", token);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(ProfileSchema.parse(body)).toMatchObject({ accountId, source: null, reviewFlags: [] });
  });

  it("answers 404 on confirm while no Profile has been built", async () => {
    const { token } = await openSession();

    const response = await request("POST", "/profile/confirm", token);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, error: "Not Found" });
  });

  it("answers 404 on a correction while no Profile has been built", async () => {
    const { token } = await openSession();
    const body = { headline: "Backend engineer", summary: null, linkedinUrl: null, githubUrl: null };

    const response = await request("PUT", "/profile/parts/basic-profile", token, body);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ statusCode: 404, error: "Not Found" });
  });

  it("answers 400 on a part the Profile does not have", async () => {
    const { token } = await openSession();

    const response = await request("POST", "/profile/parts/hobbies", token, { name: "Chess" });

    expect(response.status).toBe(400);
  });

  it("refuses an anonymous request", async () => {
    expect((await fetch(`${baseUrl}/profile`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/profile/parts/basic-profile`, { method: "PUT" })).status).toBe(401);
  });
});
