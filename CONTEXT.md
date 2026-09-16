# Help Me Get Hired

The single context of this project: a candidate prepares for a specific selection process with AI-assisted, sequential analysis whose reasoning stays visible. This file is the glossary and nothing else.

## Language

### People and identity

**Candidate**:
The person preparing for a selection process. The human using the platform.
_Avoid_: User

**Account**:
The identity of a Candidate on the platform: a verified email plus the Account Information. Created the first time a One-Time Code sent to that email is verified.
_Avoid_: User account, login, credentials

**Account Information**:
What the Candidate tells us about themselves at sign up: name, last name, phone with country code, and an optional address. Part of the Account, not of the Profile. Name, e-mail, and phone are never written into the Profile, even when a Resume states them.
_Avoid_: Personal data, identity fields, profile, contact

**One-Time Code**:
A 6-digit code sent by email that proves the Candidate controls the email. Expires 10 minutes after it is sent, is used at most once, and is replaced by the next code sent to the same email. Verifying it is how a Session opens.
_Avoid_: OTP, token, magic link, password

**Session**:
A signed-in period of an Account. Opened by verifying a One-Time Code as an opaque token, presented on every request, closed by sign out or by expiry 12 hours after it opened.
_Avoid_: Login session, auth token, JWT

### The model

**Provider**:
The company or endpoint that runs the Model a Candidate's analysis is sent to. Phase one recognises one, Anthropic. Part of a Model Choice, never named on its own.
_Avoid_: Vendor, AI company, LLM provider

**Model**:
The pinned model an Account's analysis runs on, named by the exact identifier the Provider serves and recorded on every Statement together with the prompt version, so what a Statement says is always readable back to what produced it.
_Avoid_: LLM, AI, engine, version

**Model Choice**:
The Provider and the Model an Account uses for its analysis. Exactly one per Account, chosen by the Candidate before the first analysis and changeable afterwards, which makes a re-run available rather than invalidating anything. It does not cover how the Profile is indexed for retrieval: that belongs to the platform, not to an Account.
_Avoid_: AI settings, setup, configuration, provider choice

**Model Key**:
The Candidate's own credential at the Provider of their Model Choice. Stored encrypted, scoped to one Account, never shown again after it is saved and never returned by any endpoint. The Candidate is billed by the Provider directly. Revoking it leaves the Model Choice standing and stops any further analysis until another is supplied.
_Avoid_: API key, token, credentials, secret

### Profile

**Profile**:
The structured picture of a Candidate built from their Uploaded Resume. Composed of seven parts: one Basic Profile and the lists of Experiences, Education, Projects, Skills, Languages, and Certifications. Belongs to exactly one Account. Reviewed by the Candidate, who confirms it once every field that needs review has been checked.
_Avoid_: CV, resume data

**Correction**:
The Candidate's own answer to what the recognition got wrong, written on the Profile row the Ingestion built: a part corrected, an entry added, or an entry removed. Possible until the Profile is confirmed, and replaced with everything else when a new Ingestion writes the Profile again.
_Avoid_: Edit, update, manual entry

**Basic Profile**:
The profile-level facts about a Candidate: headline, summary, LinkedIn URL, GitHub URL. A part of the Profile, not an entity of its own. Holds no name, e-mail, phone, or address; those are Account Information.
_Avoid_: Personal info, bio, contact

**Experience**:
One position in the Candidate's work history: company, role, period, description, skills. An open period (no end date) means the Candidate still holds the position.
_Avoid_: Job, employment

**Education**:
One entry in the Candidate's academic history: institution, degree, field of study, period.
_Avoid_: School, degree (as the entry), studies

**Project**:
A personal or professional piece of work the Candidate can point to: name, description, link, skills. Not tied to an Experience.
_Avoid_: Portfolio item

**Skill**:
A technology or competence the Candidate names, recognised against a dictionary that gives it a canonical name and a category. The Profile's Skills are the deduplicated union of the skills section and the skills named inside each Experience and Project, so each Skill counts once. A programming language is a Skill.
_Avoid_: Tag, keyword, technology, tech, programming language (as a Language)

**Language**:
A human language the Candidate speaks, with a level: native, fluent, advanced, intermediate, or basic. Never a programming language.
_Avoid_: Locale, tongue, idiom

**Certification**:
A credential the Candidate earned: name, issuer, year.
_Avoid_: License, badge, course

**Years of experience**:
The length of the Candidate's career, derived from the periods of the Experiences with overlapping periods counted once. Never stored, never typed by the Candidate.
_Avoid_: Seniority, career length, total experience

**Confidence**:
How sure the recognition is about one field of a Profile part. Every recognised field carries one. A field whose Confidence is below the review bar needs review: it is named in the review notice and marked in place until the Candidate confirms the Profile, which clears every mark.
_Avoid_: Score, accuracy, certainty, probability

### Profile building

**Ingestion**:
One run of profile building for an Account from one source, which is always an Uploaded Resume. Made of ordered Segments, processed through a queue, resumable after a failure, and at most one active per Account. When it completes, it replaces what the previous Ingestion from the same source wrote and never touches what another source wrote; until then the previous Profile stays as it was.
_Avoid_: Import, upload job, parsing

**Segment**:
The unit of work inside an Ingestion: one piece of the source that becomes one part of the Profile, for example the header, one Experience, the Education, or one Project. Goes through three Steps and keeps the state of the last one it completed.
_Avoid_: Chunk, task, item

**Step**:
One of the three stages a Segment goes through, in order: read (extract the raw content), recognize (turn the content into structured Profile data), save (write it to the Profile). A Segment is done when its save Step is done.
_Avoid_: Phase, stage

**Progress**:
The share of an Ingestion that is done, as a whole percentage derived from the persisted Steps of its Segments.
_Avoid_: Status bar, completion

### Profile curation

**Curation**:
One run of profile curation for a confirmed Profile. At most one active per Account; replaced only when it completes, exactly as an Ingestion replaces a Profile.
_Avoid_: Analysis, enrichment, chunking

**Curation Unit**:
The unit of work inside a Curation: one Experience, one Project, the cross-cutting competences unit, or the synthesis unit. Mirrors a Segment inside an Ingestion.
_Avoid_: Chunk, task, pass (in code)

**Statement**:
A self-contained sentence about the Candidate produced by a Curation Unit, which reads correctly with nothing around it. What is embedded and retrieved.
_Avoid_: Chunk, insight, finding, fact

**Evidence**:
The pointer a Statement carries back to the Experience, Project, or span of extracted text it was drawn from. A Statement whose Evidence does not resolve is never saved.
_Avoid_: Citation, source, reference

**Statement review**:
The Candidate's judgement on one Statement: accepted, rejected, or not yet reviewed. A rejected Statement is never retrieved for a Job Description.
_Avoid_: Feedback, rating, vote

### Documents

**Resume**:
A document. Either the PDF a Candidate uploads, or a rebuilt document targeted at one Job Description. An input to or output of the Profile, never the Profile itself.
_Avoid_: CV

**Uploaded Resume**:
A Resume whose source is the PDF the Candidate uploaded. The raw input to profile building. Passes through these states: pending (a place is reserved, the file is not there yet), uploaded (the file arrived), processing (its text is being read and the Profile built), done (the Profile is saved), failed (the file was refused or the Profile could not be built, with a reason the Candidate can act on), expired (the file never arrived). The PDF itself is discarded as soon as its text is kept.
_Avoid_: Upload, file, attachment

**Rebuilt Resume**:
A Resume whose source is the Resume Builder, written for one Job Description when the ATS score is below 8.
_Avoid_: Generated resume, optimised CV
