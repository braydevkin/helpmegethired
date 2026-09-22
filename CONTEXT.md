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
The length of the Candidate's career, derived from the periods of the Experiences with overlapping periods counted once. Never typed by the Candidate: it is counted, and recorded as a Fact when a Curation completes.
_Avoid_: Seniority, career length, total experience

**Confidence**:
How sure the recognition is about one field of a Profile part. Every recognised field carries one. A field whose Confidence is below the review bar needs review: it is named in the review notice and marked in place until the Candidate confirms the Profile, which clears every mark.
_Avoid_: Score, accuracy, certainty, probability

### Profile building

**Ingestion**:
One run of profile building for an Account from one source, which is always an Uploaded Resume. Made of ordered Segments, processed through a queue, resumable after a failure, and at most one active per Account. When it completes, it replaces what the previous Ingestion from the same source wrote and never touches what another source wrote; until then the previous Profile stays as it was.
_Avoid_: Import, upload job, parsing

**Segment**:
The unit of work inside an Ingestion: one part of the Profile read from the whole source, for example the header, the Experiences, the Education, or the Projects. Goes through three Steps and keeps the state of the last one it completed.
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
_Avoid_: Chunk, insight, finding

**Evidence**:
The pointer a Statement carries back to the Experience, Project, or span of extracted text it was drawn from. A Statement whose Evidence does not resolve is never saved.
_Avoid_: Citation, source, reference

**Statement review**:
The Candidate's judgement on one Statement: accepted, rejected, or not yet reviewed. A rejected Statement is never retrieved for a Job Description.
_Avoid_: Feedback, rating, vote

**Fact**:
Something about the Candidate counted from the confirmed Profile, not written by the Model, and recorded when a Curation completes: the Years of experience, and each Education, Certification, Language, and Skill. Belongs to its Curation. Unlike a Statement it has no Evidence, because the Profile itself is where it comes from.
_Avoid_: Metric, attribute, data point

### Job analysis

**Job Analysis**:
One analysis of one Job Description against the Candidate's current Curation, made of three Layers in order. At most one active per Account, and none while an Ingestion or a Curation is active. Keeps what it cited, so it still reads correctly after the Curation it read is replaced. Analysing the same Job Description again is possible only when something it read has changed.
_Avoid_: Analysis run, run, report, assessment

**Layer**:
One step of a Job Analysis, in this order: Requirement Match, ATS Score, Resume Builder. A Layer starts only when the one before it has completed, and a Job Analysis that stopped continues at its first unfinished Layer. The order is fixed; nothing chooses what runs next.
_Avoid_: Agent, tool, stage, Step (a Step belongs to a Segment)

**Requirement**:
Something a Job Description asks for, either required or preferred, together with the words of the Job Description that ask for it. A Requirement whose words are not in the Job Description does not exist.
_Avoid_: Criterion, keyword, qualification

**Match**:
The link between one Requirement and the one Statement or Fact that supports it, with the reason. Carries no number. A rejected Statement never supports a Match.
_Avoid_: Hit, similarity, score

**Strength**:
A Requirement of a Job Analysis that has at least one Match.
_Avoid_: Advantage, pro

**Weakness**:
A Requirement of a Job Analysis that has no Match. A fact about one Job Description, never about the Candidate in general.
_Avoid_: Gap, missing skill, con

**ATS Score**:
A whole number from 0 to 10 saying how much of a Job Description the Strengths cover, a required Requirement counting twice a preferred one. Counted by a versioned rule set, never judged by the Model. It measures coverage, not how an employer's system reads a file. Below 8, the Resume Builder writes a Rebuilt Resume.
_Avoid_: ATS level, rating, fit, match percentage

### Documents

**Job Description**:
The text of one position the Candidate is preparing for, pasted by them. Belongs to one Account, is kept as pasted and never edited, and the same text pasted again by the same Account is the same Job Description.
_Avoid_: Job posting, vacancy, JD, job

**Resume**:
A document. Either the PDF a Candidate uploads, or a rebuilt document targeted at one Job Description. An input to or output of the Profile, never the Profile itself.
_Avoid_: CV

**Uploaded Resume**:
A Resume whose source is the PDF the Candidate uploaded. The raw input to profile building. Passes through these states: pending (a place is reserved, the file is not there yet), uploaded (the file arrived), processing (its text is being read and the Profile built), done (the Profile is saved), failed (the file was refused or the Profile could not be built, with a reason the Candidate can act on), expired (the file never arrived). The PDF itself is discarded as soon as its text is kept.
_Avoid_: Upload, file, attachment

**Rebuilt Resume**:
A Resume whose source is the Resume Builder, written for one Job Description when its ATS Score is below 8. Every sentence rests on a Statement or a Fact it names, and a Weakness is never claimed. Rebuilding does not change the ATS Score.
_Avoid_: Generated resume, optimised CV
