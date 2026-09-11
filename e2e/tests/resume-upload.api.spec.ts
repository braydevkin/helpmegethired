import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";
import { ProfileSchema } from "@helpmegethired/shared";

import { hasStatus, progressOf, progressUntil, statementsOf, storeModelKey } from "./helpers/curation-api.js";
import { apiAs, apiUrl, corpusPdf, parsed, resumeFixtures, SETTLE_TIMEOUT_MS, settled, upload } from "./helpers/resume-api.js";
import { signUpAndReadSessionToken } from "./helpers/sign-in.js";

const hostilePdf = (name: string) => readFileSync(join(resumeFixtures, "hostile", `${name}.pdf`));

interface ExpectedDraft {
  draft: { experiences: { role: { value: string }; company: { value: string } | null }[]; skills: { name: string }[] };
}

const expectedDraft = (slug: string): ExpectedDraft => JSON.parse(readFileSync(join(resumeFixtures, "corpus/expected", `${slug}.json`), "utf8")) as ExpectedDraft;

test.describe("the upload API, from a PDF to a completed Curation", () => {
  test("takes a synthetic resume to a confirmed Profile and a completed Curation, and a hostile file to failed with its code", async ({ page, playwright }) => {
    test.setTimeout(SETTLE_TIMEOUT_MS * 4);

    const { token } = await signUpAndReadSessionToken(page);
    const api = await apiAs(playwright.request, token);

    await test.step("a new Account has an empty Profile", async () => {
      const profile = await parsed(await api.get("/profile"), ProfileSchema);

      expect(profile).toMatchObject({ source: null, experiences: [], reviewFlags: [] });
    });

    await test.step("the synthetic resume ends done with a Profile that matches its expected output", async () => {
      const slug = "ada-single-column-en";
      const uploaded = await upload(api, corpusPdf(slug), `${slug}.pdf`);

      expect(uploaded.status).toBe("uploaded");

      const done = await settled(api, uploaded.id);

      expect(done).toMatchObject({ status: "done", errorCode: null, progress: { percentage: 100 } });

      const profile = await parsed(await api.get("/profile"), ProfileSchema);
      const expected = expectedDraft(slug);

      expect(profile.source).toMatchObject({ kind: "upload", uploadedResumeId: uploaded.id, fileName: `${slug}.pdf` });
      expect(profile.experiences.map((experience) => [experience.role, experience.company])).toEqual(
        expected.draft.experiences.map((experience) => [experience.role.value, experience.company?.value ?? null]),
      );
      expect(profile.skills.map((skill) => skill.name).sort()).toEqual(expected.draft.skills.map((skill) => skill.name).sort());
      expect(profile.yearsOfExperience).toBeGreaterThan(0);
    });

    await test.step("confirming clears the review flags and is idempotent", async () => {
      const confirmed = await parsed(await api.post("/profile/confirm"), ProfileSchema);
      const again = await parsed(await api.post("/profile/confirm"), ProfileSchema);

      expect(confirmed.reviewFlags).toEqual([]);
      expect(confirmed.confirmedAt).not.toBeNull();
      expect(again.confirmedAt).toBe(confirmed.confirmedAt);
    });

    await test.step("storing a Model Key starts a Curation that completes against the fake, with Statements that cite the Profile", async () => {
      await storeModelKey(api);

      const completed = await progressUntil(api, hasStatus("completed", "failed"));

      expect(completed).toMatchObject({ status: "completed", percentage: 100, failureReason: null });
      expect(completed?.units.saved).toBe(completed?.units.total);

      const { curationId, statements } = await statementsOf(api);

      expect(curationId).toBe(completed?.curationId);
      expect(statements.length).toBeGreaterThan(0);
      expect(statements.filter((statement) => statement.evidence.length === 0)).toEqual([]);
    });

    await test.step("a file that is not a PDF ends failed with not_pdf and leaves the Profile and its Curation", async () => {
      const uploaded = await upload(api, hostilePdf("wrong-magic-bytes"), "wrong-magic-bytes.pdf");
      const failed = await settled(api, uploaded.id);

      expect(failed).toMatchObject({ status: "failed", errorCode: "not_pdf", progress: null });

      const profile = await parsed(await api.get("/profile"), ProfileSchema);

      expect(profile.source?.fileName).toBe("ada-single-column-en.pdf");
      expect(await progressOf(api)).toMatchObject({ status: "completed" });
      expect((await statementsOf(api)).statements.length).toBeGreaterThan(0);
    });

    await api.dispose();
  });

  test("refuses every route without the Session, and the docs answer without one", async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: apiUrl });

    for (const path of ["/profile", "/resumes", "/auth/account", "/profile/curation", "/profile/curation/statements"]) {
      expect((await api.get(path)).status()).toBe(401);
    }

    expect((await api.get("/docs/openapi.json")).status()).toBe(200);

    await api.dispose();
  });
});
