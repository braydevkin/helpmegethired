import { Inject, Injectable } from "@nestjs/common";
import { sql, type ExpressionBuilder } from "kysely";
import type {
  BasicProfile,
  Certification,
  DraftBasicProfile,
  DraftCertification,
  DraftEducation,
  DraftExperience,
  DraftLanguage,
  DraftProject,
  DraftSkill,
  Education,
  Experience,
  Id,
  IngestionSource,
  Language,
  Period,
  Project,
  Skill,
} from "@helpmegethired/shared";

import { DATABASE, type Database } from "../database/database";
import type { BasicProfileRow, DatabaseSchema } from "../database/database.schema";
import type { SegmentContext } from "../ingestion/segment-processor";
import { asJson } from "../ingestion/ingestion.mapper";
import { toBasicProfile, toCertification, toEducation, toExperience, toLanguage, toProject, toSkill } from "./profile.mapper";

export interface ProfileRows {
  basicProfile: BasicProfileRow | undefined;
  experiences: Experience[];
  education: Education[];
  projects: Project[];
  skills: Skill[];
  languages: Language[];
  certifications: Certification[];
}

export interface StoredBasicProfile extends BasicProfile {
  confirmedAt: Date | null;
}

const PART_TABLES = ["experiences", "education", "projects", "skills", "languages", "certifications"] as const;
const ORDER = ["segment_position", "position"] as const;

interface IngestionRows {
  account_id: Id;
  source_ingestion_id: Id;
}

const byIngestion =
  (rows: IngestionRows) =>
  ({ and, eb }: ExpressionBuilder<DatabaseSchema, "basic_profiles" | (typeof PART_TABLES)[number]>) =>
    and([eb("account_id", "=", rows.account_id), eb("source_ingestion_id", "=", rows.source_ingestion_id)]);

const periodColumns = (period: Period | null) => ({ period_start: period?.start ?? null, period_end: period?.end ?? null });

const rowIdentity = (context: SegmentContext) => ({
  account_id: context.accountId,
  source_ingestion_id: context.ingestionId,
  segment_id: context.segmentId,
});

const orderedRowIdentity = (context: SegmentContext, position: number) => ({
  ...rowIdentity(context),
  segment_position: context.position,
  position,
});

// Every method takes the Account first, so a row of another Account answers as absent. The
// rows are read per Ingestion: the service picks the latest completed one of the source.
@Injectable()
export class ProfileRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async rowsOf(accountId: Id, ingestionId: Id): Promise<ProfileRows> {
    const inOrder = { account_id: accountId, source_ingestion_id: ingestionId };

    return {
      basicProfile: await this.database.selectFrom("basic_profiles").selectAll().where(byIngestion(inOrder)).executeTakeFirst(),
      experiences: (await this.database.selectFrom("experiences").selectAll().where(byIngestion(inOrder)).orderBy(ORDER).execute()).map(toExperience),
      education: (await this.database.selectFrom("education").selectAll().where(byIngestion(inOrder)).orderBy(ORDER).execute()).map(toEducation),
      projects: (await this.database.selectFrom("projects").selectAll().where(byIngestion(inOrder)).orderBy(ORDER).execute()).map(toProject),
      skills: (await this.database.selectFrom("skills").selectAll().where(byIngestion(inOrder)).orderBy(ORDER).execute()).map(toSkill),
      languages: (await this.database.selectFrom("languages").selectAll().where(byIngestion(inOrder)).orderBy(ORDER).execute()).map(toLanguage),
      certifications: (await this.database.selectFrom("certifications").selectAll().where(byIngestion(inOrder)).orderBy(ORDER).execute()).map(
        toCertification,
      ),
    };
  }

  async confirm(accountId: Id, ingestionId: Id, database: Database = this.database): Promise<StoredBasicProfile | undefined> {
    const row = await database
      .updateTable("basic_profiles")
      .set({ confirmed_at: sql<Date>`coalesce(confirmed_at, now())` })
      .where("account_id", "=", accountId)
      .where("source_ingestion_id", "=", ingestionId)
      .returningAll()
      .executeTakeFirst();

    return row && { ...toBasicProfile(row), confirmedAt: row.confirmed_at };
  }

  // A save that runs again after a crash replaces what its Segment wrote, never doubling it.
  saveBasicProfile(context: SegmentContext, draft: DraftBasicProfile): Promise<void> {
    return this.replacingSegmentRows(context, "basic_profiles", async (transaction) => {
      await transaction
        .insertInto("basic_profiles")
        .values({
          ...rowIdentity(context),
          headline: draft.headline?.value ?? null,
          summary: draft.summary?.value ?? null,
          linkedin_url: draft.linkedinUrl?.value ?? null,
          github_url: draft.githubUrl?.value ?? null,
          confirmed_at: null,
        })
        .execute();
    });
  }

  saveExperiences(context: SegmentContext, experiences: readonly DraftExperience[]): Promise<void> {
    return this.replacingSegmentRows(context, "experiences", async (transaction) => {
      if (experiences.length > 0) {
        await transaction
          .insertInto("experiences")
          .values(
            experiences.map((experience, position) => ({
              ...orderedRowIdentity(context, position),
              ...periodColumns(experience.period?.value ?? null),
              company: experience.company?.value ?? null,
              role: experience.role.value,
              description: experience.description?.value ?? null,
              skills: asJson(experience.skills),
            })),
          )
          .execute();
      }
    });
  }

  saveEducation(context: SegmentContext, education: readonly DraftEducation[]): Promise<void> {
    return this.replacingSegmentRows(context, "education", async (transaction) => {
      if (education.length > 0) {
        await transaction
          .insertInto("education")
          .values(
            education.map((entry, position) => ({
              ...orderedRowIdentity(context, position),
              ...periodColumns(entry.period?.value ?? null),
              institution: entry.institution.value,
              degree: entry.degree?.value ?? null,
              field_of_study: entry.fieldOfStudy?.value ?? null,
            })),
          )
          .execute();
      }
    });
  }

  saveProjects(context: SegmentContext, projects: readonly DraftProject[]): Promise<void> {
    return this.replacingSegmentRows(context, "projects", async (transaction) => {
      if (projects.length > 0) {
        await transaction
          .insertInto("projects")
          .values(
            projects.map((project, position) => ({
              ...orderedRowIdentity(context, position),
              name: project.name.value,
              description: project.description?.value ?? null,
              url: project.url?.value ?? null,
              skills: asJson(project.skills),
            })),
          )
          .execute();
      }
    });
  }

  saveSkills(context: SegmentContext, skills: readonly DraftSkill[]): Promise<void> {
    return this.replacingSegmentRows(context, "skills", async (transaction) => {
      if (skills.length > 0) {
        await transaction
          .insertInto("skills")
          .values(skills.map((skill, position) => ({ ...orderedRowIdentity(context, position), name: skill.name, category: skill.category })))
          .execute();
      }
    });
  }

  saveLanguages(context: SegmentContext, languages: readonly DraftLanguage[]): Promise<void> {
    return this.replacingSegmentRows(context, "languages", async (transaction) => {
      if (languages.length > 0) {
        await transaction
          .insertInto("languages")
          .values(
            languages.map((language, position) => ({
              ...orderedRowIdentity(context, position),
              name: language.name.value,
              level: language.level?.value ?? null,
            })),
          )
          .execute();
      }
    });
  }

  saveCertifications(context: SegmentContext, certifications: readonly DraftCertification[]): Promise<void> {
    return this.replacingSegmentRows(context, "certifications", async (transaction) => {
      if (certifications.length > 0) {
        await transaction
          .insertInto("certifications")
          .values(
            certifications.map((certification, position) => ({
              ...orderedRowIdentity(context, position),
              name: certification.name.value,
              issuer: certification.issuer?.value ?? null,
              year: certification.year?.value ?? null,
            })),
          )
          .execute();
      }
    });
  }

  // When an Ingestion completes, the rows the earlier Ingestions of the same source wrote go;
  // what another source wrote stays.
  async deleteRowsOfEarlierIngestions(accountId: Id, source: IngestionSource, keptIngestionId: Id, transaction: Database): Promise<void> {
    const earlier = transaction
      .selectFrom("ingestions")
      .select("id")
      .where("account_id", "=", accountId)
      .where("source", "=", source)
      .where("id", "!=", keptIngestionId);

    for (const table of ["basic_profiles", ...PART_TABLES] as const) {
      await transaction.deleteFrom(table).where("account_id", "=", accountId).where("source_ingestion_id", "in", earlier).execute();
    }
  }

  private replacingSegmentRows(
    context: SegmentContext,
    table: (typeof PART_TABLES)[number] | "basic_profiles",
    insert: (transaction: Database) => Promise<void>,
  ): Promise<void> {
    return this.database.transaction().execute(async (transaction) => {
      await transaction.deleteFrom(table).where("segment_id", "=", context.segmentId).execute();
      await insert(transaction);
    });
  }
}
