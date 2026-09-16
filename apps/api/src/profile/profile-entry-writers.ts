import { BadRequestException } from "@nestjs/common";
import {
  CertificationCorrectionSchema,
  EducationCorrectionSchema,
  ExperienceCorrectionSchema,
  LanguageCorrectionSchema,
  ProjectCorrectionSchema,
  SkillCorrectionSchema,
  type Id,
  type Period,
  type ProfileListPart,
} from "@helpmegethired/shared";
import { sql } from "kysely";
import type { z, ZodType } from "zod";

import { validationErrorBody } from "../common/zod-validation.pipe";
import type { Database } from "../database/database";
import { asJson } from "../ingestion/ingestion.mapper";

// Where a new entry goes: the Account's latest completed Ingestion, at the end of the part.
// It belongs to no Segment, because nothing was recognized for it.
export interface EntryPlacement {
  account_id: Id;
  source_ingestion_id: Id;
  segment_position: number;
  position: number;
}

// One part's whole correction surface: the payload it accepts, and the two writes it answers.
export interface ProfileEntryWriter {
  add(database: Database, placement: EntryPlacement, body: unknown): Promise<void>;
  replace(database: Database, accountId: Id, entryId: Id, body: unknown): Promise<boolean>;
}

interface EntryOperations<Entry> {
  add(database: Database, placement: EntryPlacement, entry: Entry): Promise<void>;
  replace(database: Database, accountId: Id, entryId: Id, entry: Entry): Promise<boolean>;
}

function parsed<Schema extends ZodType>(schema: Schema, body: unknown): z.infer<Schema> {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new BadRequestException(validationErrorBody(result.error));
  }

  return result.data;
}

const writer = <Schema extends ZodType>(schema: Schema, operations: EntryOperations<z.infer<Schema>>): ProfileEntryWriter => ({
  add: (database, placement, body) => operations.add(database, placement, parsed(schema, body)),
  replace: (database, accountId, entryId, body) => operations.replace(database, accountId, entryId, parsed(schema, body)),
});

// A write by the Candidate is what edited_at records: the entry carries their judgement from
// here on, so the review notice stops asking about it.
const corrected = { edited_at: sql<Date>`now()` };
const newEntry = (placement: EntryPlacement) => ({ ...placement, segment_id: null, ...corrected });
const periodColumns = (period: Period | null) => ({ period_start: period?.start ?? null, period_end: period?.end ?? null });

const changed = (result: { numUpdatedRows: bigint }): boolean => result.numUpdatedRows > 0n;

export const PROFILE_ENTRY_WRITERS = {
  experiences: writer(ExperienceCorrectionSchema, {
    async add(database, placement, entry) {
      await database
        .insertInto("experiences")
        .values({
          ...newEntry(placement),
          ...periodColumns(entry.period),
          company: entry.company,
          role: entry.role,
          description: entry.description,
          skills: asJson(entry.skills),
        })
        .execute();
    },
    async replace(database, accountId, entryId, entry) {
      return changed(
        await database
          .updateTable("experiences")
          .set({
            ...corrected,
            ...periodColumns(entry.period),
            company: entry.company,
            role: entry.role,
            description: entry.description,
            skills: asJson(entry.skills),
          })
          .where("id", "=", entryId)
          .where("account_id", "=", accountId)
          .executeTakeFirst(),
      );
    },
  }),

  education: writer(EducationCorrectionSchema, {
    async add(database, placement, entry) {
      await database
        .insertInto("education")
        .values({
          ...newEntry(placement),
          ...periodColumns(entry.period),
          institution: entry.institution,
          degree: entry.degree,
          field_of_study: entry.fieldOfStudy,
        })
        .execute();
    },
    async replace(database, accountId, entryId, entry) {
      return changed(
        await database
          .updateTable("education")
          .set({
            ...corrected,
            ...periodColumns(entry.period),
            institution: entry.institution,
            degree: entry.degree,
            field_of_study: entry.fieldOfStudy,
          })
          .where("id", "=", entryId)
          .where("account_id", "=", accountId)
          .executeTakeFirst(),
      );
    },
  }),

  projects: writer(ProjectCorrectionSchema, {
    async add(database, placement, entry) {
      await database
        .insertInto("projects")
        .values({ ...newEntry(placement), name: entry.name, description: entry.description, url: entry.url, skills: asJson(entry.skills) })
        .execute();
    },
    async replace(database, accountId, entryId, entry) {
      return changed(
        await database
          .updateTable("projects")
          .set({ ...corrected, name: entry.name, description: entry.description, url: entry.url, skills: asJson(entry.skills) })
          .where("id", "=", entryId)
          .where("account_id", "=", accountId)
          .executeTakeFirst(),
      );
    },
  }),

  skills: writer(SkillCorrectionSchema, {
    async add(database, placement, entry) {
      await database.insertInto("skills").values({ ...newEntry(placement), name: entry.name, category: entry.category }).execute();
    },
    async replace(database, accountId, entryId, entry) {
      return changed(
        await database
          .updateTable("skills")
          .set({ ...corrected, name: entry.name, category: entry.category })
          .where("id", "=", entryId)
          .where("account_id", "=", accountId)
          .executeTakeFirst(),
      );
    },
  }),

  languages: writer(LanguageCorrectionSchema, {
    async add(database, placement, entry) {
      await database.insertInto("languages").values({ ...newEntry(placement), name: entry.name, level: entry.level }).execute();
    },
    async replace(database, accountId, entryId, entry) {
      return changed(
        await database
          .updateTable("languages")
          .set({ ...corrected, name: entry.name, level: entry.level })
          .where("id", "=", entryId)
          .where("account_id", "=", accountId)
          .executeTakeFirst(),
      );
    },
  }),

  certifications: writer(CertificationCorrectionSchema, {
    async add(database, placement, entry) {
      await database
        .insertInto("certifications")
        .values({ ...newEntry(placement), name: entry.name, issuer: entry.issuer, year: entry.year })
        .execute();
    },
    async replace(database, accountId, entryId, entry) {
      return changed(
        await database
          .updateTable("certifications")
          .set({ ...corrected, name: entry.name, issuer: entry.issuer, year: entry.year })
          .where("id", "=", entryId)
          .where("account_id", "=", accountId)
          .executeTakeFirst(),
      );
    },
  }),
} as const satisfies Record<ProfileListPart, ProfileEntryWriter>;
