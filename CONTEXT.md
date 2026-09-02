# Help Me Get Hired

The single context of this project: a candidate prepares for a specific selection process with AI-assisted, sequential analysis whose reasoning stays visible. This file is the glossary and nothing else.

## Language

### People and identity

**Candidate**:
The person preparing for a selection process. The human using the platform.
_Avoid_: User

**Account**:
The login identity of a Candidate: email, credentials, session.
_Avoid_: User account, login

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

### Documents

**Resume**:
A document. Either the PDF a Candidate uploads, or a rebuilt document targeted at one Job Description. An input to or output of the Profile, never the Profile itself.
_Avoid_: CV

**Uploaded Resume**:
A Resume whose source is the PDF the Candidate uploaded. The raw input to profile building.

**Rebuilt Resume**:
A Resume whose source is the Resume Builder, written for one Job Description when the ATS score is below 8.
_Avoid_: Generated resume, optimised CV
