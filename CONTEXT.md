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
What the Candidate tells us about themselves at sign up: name, last name, phone with country code, and an optional address. Part of the Account, not of the Profile.
_Avoid_: Personal data, identity fields, profile

**One-Time Code**:
A 6-digit code sent by email that proves the Candidate controls the email. Expires 10 minutes after it is sent, is used at most once, and is replaced by the next code sent to the same email. Verifying it is how a Session opens.
_Avoid_: OTP, token, magic link, password

**Session**:
A signed-in period of an Account. Opened by verifying a One-Time Code as an opaque token, presented on every request, closed by sign out or by expiry 12 hours after it opened.
_Avoid_: Login session, auth token, JWT

**Profile**:
The structured picture of a Candidate built from their Resume and LinkedIn data: basic profile, experiences, projects.
_Avoid_: CV, resume data

**Resume**:
A document. Either the PDF a Candidate uploads, or a rebuilt document targeted at one Job Description. An input to or output of the Profile, never the Profile itself.
_Avoid_: CV
### Profile

**Profile**:
The structured picture of a Candidate built from their Resume and LinkedIn data. Composed of one Basic Profile, a list of Experiences, and a list of Projects. Belongs to exactly one Account.
_Avoid_: CV, resume data

**Basic Profile**:
The profile-level facts about a Candidate: full name, headline, summary, location, LinkedIn URL. A part of the Profile, not an entity of its own.
_Avoid_: Personal info, bio

**Experience**:
One position in the Candidate's work history: company, role, period, description, skills. An open period (no end date) means the Candidate still holds the position.
_Avoid_: Job, employment

**Project**:
A personal or professional piece of work the Candidate can point to: name, description, link, skills. Not tied to an Experience.
_Avoid_: Portfolio item

### Profile building

**Ingestion**:
One run of profile building for an Account from one source (an Uploaded Resume or a LinkedIn profile). Made of ordered Segments, processed through a queue, resumable after a failure, and at most one active per Account.
_Avoid_: Import, upload job, parsing

**Segment**:
The unit of work inside an Ingestion: one piece of the source that becomes one part of the Profile, for example the basic information, one Experience, or one Project. Goes through three Steps and keeps the state of the last one it completed.
_Avoid_: Chunk, task, item

**Step**:
One of the three stages a Segment goes through, in order: read (extract the raw content), recognize (turn the content into structured Profile data), save (write it to the Profile). A Segment is done when its save Step is done.
_Avoid_: Phase, stage

**Progress**:
The share of an Ingestion that is done, as a whole percentage derived from the persisted Steps of its Segments.
_Avoid_: Status bar, completion

### Documents

**Resume**:
A document. Either the PDF a Candidate uploads, or a rebuilt document targeted at one Job Description. An input to or output of the Profile, never the Profile itself.
_Avoid_: CV

**Uploaded Resume**:
A Resume whose source is the PDF the Candidate uploaded. The raw input to profile building.

**Rebuilt Resume**:
A Resume whose source is the Resume Builder, written for one Job Description when the ATS score is below 8.
_Avoid_: Generated resume, optimised CV
