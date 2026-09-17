# ADR-0025: The Candidate's Model reads the résumé, and the rules verify every value it read

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** @braydevkin

## Context

TC-01 had the Profile recognised from the stored Resume text by rules, with a Confidence per field, and left model extraction for later. The rules give the Profile a structure, but testing the local stack with a real résumé showed how much of it they get wrong. A wrapped bullet line became a role ("developer review", at the company "cutting delivery time by"). A job under a sub-heading was read as a Project, and a certification landed in Education. A line of labelled technology groups became 51 spoken Languages (#181). Descriptions stopped mid-sentence wherever the rules cut a job in two. Profile Curation reads the confirmed Profile (ADR-0024), so everything downstream inherits these mistakes. The Candidate corrects what they can see (#177, #178), but a Profile that needs rebuilding by hand is not a Profile the platform built.

Three earlier decisions bound what can replace the rules:

- **ADR-0023:** the platform pays for no generation. Its only model spend is embeddings, on one platform key.
- **ADR-0024:** Curation reads the confirmed Profile, one Curation Unit at a time, and retrieves nothing.
- **ADR-0009:** every AI analysis layer retrieves from pgvector before calling the model. Recognition runs before any Statement exists, so this ADR has to say whether that rule applies to it.

The PDF is deleted once its text is stored, so the stored text is the only thing that can be read again. The issue is #182, and this record is #189.

## Decision

**The Candidate's Model reads the stored Resume text once per Profile part, answering every value with the words it read it from; the rules verify each value through that quote and decide its Confidence; and the Model decides which entries exist.**

- **The Candidate pays, and the key comes first.** Recognition uses the Account's Model Choice and Model Key under ADR-0023, unchanged: the Candidate is billed by their own Provider. Choose your AI therefore moves before the upload. The journey opens `/journey/ai` until a Model Key is stored, and `POST /resumes` refuses with `409 model_key_missing` without one.
- **One Segment per Profile part, each reading the whole résumé.** The seven parts are header, experience, education, project, skills, languages and certifications. Each is one Segment of the Ingestion's queue, so recognition stays resumable per Segment (TC-03, TC-04). Each call sends the whole cleaned text, capped at 30,000 characters and cut at a line boundary, with the truncation known.
- **Every value comes with its quote.** The Model answers the part's shared schema (`SEGMENT_RECOGNITION_SCHEMAS` in `packages/shared`), where every value carries the verbatim text it was read from. The answer is parsed like every model response in `docs/security.md`, and one that does not validate is a failed call.
- **The rules verify, in pure functions.**
  - A value is kept only when its quote is in the text, and a text value must be said by its own quote.
  - When both readings agree, the Confidence is `high`.
  - When only the Model read a value, it is `high` if a rule confirms it (a period, a year, a URL, a known term) and `medium` otherwise.
  - When the readings disagree, the Confidence is `low`, which flags the field for review. The rules' period, year and URL are kept, with the Model's text.
  - An entry whose naming field is not grounded is dropped whole.
  - The comparison of the name and e-mail with the Account stays the rules' alone, and name, e-mail and phone never reach a Profile table.
- **The Model decides which entries exist.** The rules cut entries where a layout misleads them, so an entry only the rules read is taken for a mis-cut and left out. An entry only the Model read is kept.
- **No silent fallback.** A failed Model call throws, so the Ingestion's attempts apply. A Model Key the Provider refuses fails the Profile build instead of quietly keeping the rules' reading. The rules' reading stands alone only where there is no Model Key to read with: a key revoked while an Ingestion runs, and the corpus measurements, which run without one. `MODEL_ADAPTER` selects the Anthropic adapter or the deterministic fake, under ADR-0023's rule that platform configuration makes that choice and the presence of a key never does.
- **The stored text is read again, never the PDF.** `POST /profile/recognition` starts a new Ingestion over the stored text of the Uploaded Resume behind the Profile. As with any Ingestion, it replaces the Profile rows, the corrections, the confirmation and a current Curation.
- **"RAG before every AI analysis" does not apply to recognition.** ADR-0009's rule governs the analysis layers, which run against a Job Description and read Statements. Recognition is not one of those layers. It builds the Profile those layers stand on, before anything exists in pgvector to retrieve, and its input is already bounded by the cap. Like Curation (ADR-0024), it retrieves nothing.

## Alternatives considered

- **Rules only, as TC-01 had it.** No model call and no cost, but it builds the wrong Profile described above, and every later layer reads that Profile.
- **The Model alone, with nothing checking it.** Simpler, but nothing would stop a value the résumé never says from reaching the Profile, and that is the worst failure for a product whose reasoning must be traceable to the Candidate's own words.
- **The Model reading each block the rules cut.** This was built first. It sends less text per call, but the Model then read fragments: a wrapped bullet came back as a role, and a job as a Project. It was replaced on 2026-09-16 by one Segment per part over the whole text (commit `38fe8d6`).
- **The rules decide the entries and the Model fills in their fields.** This keeps a deterministic entry list, but it keeps exactly the cuts that were wrong.
- **A platform key for recognition.** This would remove the key step before the upload, but the project would pay for generation on every upload, which ADR-0023 rejected.
- **Asking for the PDF again to rebuild a Profile.** It needs no new endpoint, but the PDF is deleted after extraction, and asking a Candidate to upload again to fix the platform's reading puts the cost on the wrong side.

## Consequences

- Positive: the Profile is built from the whole résumé, with whole descriptions under the right part. Every saved value can be traced to words in the résumé, and every disagreement between the Model and the rules is shown to the Candidate for review. A Profile built before this release can be read again without a new upload.
- Negative: a Candidate cannot upload until they have a Model Key, so the Provider step moves in front of the first thing the product does.
- Negative: the whole Resume text reaches the Candidate's Provider at the upload, under the Candidate's own agreement with it. That includes the header lines with the name, e-mail and phone, even though they are never saved to the Profile.
- Negative: one Ingestion is seven model calls over the whole text, on the Candidate's bill.
- Negative: an entry written past the 30,000th character is left out, because the Model decides which entries exist.
- Negative: an Ingestion does not pause on a Provider rate limit or a refused key. Each spends an attempt, and a refused key fails the build.
- Negative: the recognition prompt version (`recognition/2`) is a constant in the code and is not recorded on the Profile rows it produced.
- Follow-ups:
  - Pause an Ingestion on a rate limit or a refused Model Key, as a Curation pauses with `resume_after`.
  - Check the Model Key again at `POST /resumes/:id/complete`.
  - Remove `linkedin` from `IngestionSourceSchema`.
  - The rules alone still misread labelled technology groups (#181). That now reaches only a Profile built before this release or by the development stand-in.
  - `docs/product/requirements.md` TC-01 describes this decision, and `docs/architecture.md`, "Recognition verified by the rules", describes how it is built.
