# Requirements

Derived from `arch/hgh.drawio`. When the diagram and this document disagree, this document wins and the diagram should be updated.

## Functional requirements

| ID | Requirement |
| --- | --- |
| FR-01 | Account sign up and sign in with an email and a one-time code sent by email; no passwords. Sign up adds the Account information: name, last name, phone with country code, optional address. |
| FR-02 | Upload a Resume as a PDF of at most 5 MB and 20 pages. The upload is refused with a reason the Candidate can act on when the file is not a PDF, is too large, has too many pages, is password-protected, is damaged, or is a scan without text. |
| FR-03 | Removed: LinkedIn is not read (#104). The Profile is built from the Uploaded Resume alone. |
| FR-04 | Build a candidate profile from the Uploaded Resume: basic profile, experiences, education, projects, skills, languages, certifications. The Candidate corrects what the recognition got wrong before confirming it: any part corrected, an entry added, an entry removed, until the Profile is confirmed. |
| FR-05 | Paste a Job Description, once a Curation has completed. It is kept per Account as pasted and never edited, and the same text pasted again by the same Account is the same Job Description. Each Job Description is analysed by a Job Analysis: the Layers of FR-06 and FR-07, in that order. |
| FR-06 | Requirement Match, the first Layer: the Job Description is read into Requirements, each required or preferred and quoted from it, and each Requirement is matched to the Candidate's Statements and Facts, never the Profile (ADR-0024). The Requirements with a Match are the Strengths for that role, those without are the Weaknesses. A rejected Statement never supports a Match. |
| FR-07 | ATS Score, then Resume Builder, the second and third Layers. The ATS Score is a whole number from 0 to 10, counted by a versioned rule set from the Strengths and Weaknesses with no Model call: a required Requirement weighs 2, a preferred one 1. Below 8, the Resume Builder writes a Rebuilt Resume in which every sentence rests on a Statement or a Fact and no Weakness is claimed; at 8 or more it is skipped. |
| FR-08 | AI recommendations for studies (learnings and a structured study plan). |
| FR-09 | AI mock interview for the target role. |
| FR-10 | Apply helper: cover letter, updated resume, and study plan for a specific job description. |
| FR-11 | Preparation summary with success rates across all steps. |
| FR-12 | Profile Curation: the confirmed Profile is read once, on the Candidate's own Model Key, into Statements that each carry the Evidence behind them, and the Candidate can accept or reject each Statement. |

## Application flow

The candidate journey is strictly ordered. Each step becomes available only when the previous one is complete.

```
Sign Up / Sign In
  └─ Choose the Model and supply the Model Key
      └─ Upload Resume PDF
          └─ Confirm Profile
              └─ Profile Curation
                  └─ Profile analysis with the evidence behind it
                      └─ Paste Job Description
                          └─ Requirement Match: strengths and weaknesses for that role
                              └─ ATS Score
                                  └─ Resume Builder, when the ATS Score is below 8
                                      └─ AI Study Recommendations
                                          └─ AI Mock Interview
                                              └─ Preparation summary with all success rates
```

- The Model Key comes before the upload because the Candidate's own Model reads the Resume; an upload is refused while no usable key is stored.
- Profile Curation starts once the Profile is confirmed and a Model Key is stored, whichever comes last (ADR-0024).
- Strengths and weaknesses are not a Profile-level step. A weakness is only a fact when something specific is missing for something specific, so they are produced per Job Description by the layer that holds the target.
- Requirement Match, ATS Score and Resume Builder are the Layers of one Job Analysis (#195). A Job Description can be analysed again only when something the newest completed Job Analysis read has changed: the Curation, a Statement review, the Model Choice, a prompt version, or the ATS rule set version.

## Business logic (AI services)

These are the Layers of the pipeline. They run in this order for a given Job Description, each only once the previous one has completed (TC-06). The order is fixed in code: no model chooses what runs next (ADR-0024).

| Layer | Behaviour |
| --- | --- |
| **Requirement Match** | Read the Job Description into Requirements and match each one to the Candidate's Statements and Facts, giving the Strengths and Weaknesses for that role. |
| **ATS Score** | Count how much of the Job Description the Strengths cover, as a whole number from 0 to 10, by a versioned rule set with no Model call. |
| **Resume Builder** | If the ATS Score is below 8, write a Rebuilt Resume for that Job Description from the Candidate's Statements and Facts, every sentence resting on one of them. |
| **Learning with job applications** | Based on previous job applications, define what the Candidate should learn to improve their chances of getting hired. |
| **Learn with AI** | Based on the Candidate's list of learnings, create a fully structured study plan with content to learn. |
| **Apply Helper** | Send the Candidate a cover letter for the specific Job Description, together with the Resume and the study plan. |

## Domain entities

| Entity | Notes |
| --- | --- |
| Account | Authentication identity. |
| Uploaded Resume | The PDF a Candidate uploaded, its status, and the text extracted from it. The PDF itself is deleted once the text is kept. |
| Basic Profile | Headline, summary, LinkedIn URL, GitHub URL. Name, e-mail, and phone belong to the Account, never to the Profile. |
| Experiences | Work history. Input to Profile Curation. |
| Education | Academic history. Counted into the facts every Curation prompt receives. |
| Projects | Personal or professional projects. Input to Profile Curation. |
| Skills | Technologies and competences, grouped by category. Input to Profile Curation. |
| Languages | Spoken languages with a level. Counted into the facts every Curation prompt receives. |
| Certifications | Credentials with issuer and year. Counted into the facts every Curation prompt receives. |
| Statements | Self-contained sentences about the Candidate, each with its Evidence, produced by Profile Curation; embedded for RAG and read by every later AI layer. |
| Facts | Counted from the confirmed Profile and recorded when a Curation completes; read whole by every Layer next to the retrieved Statements. |
| Job Descriptions | Stored per Account as pasted, never edited. |
| Job Analyses | One per analysis of a Job Description: its Layers and their output, with copies of the Statements and Facts it cites, so it stays readable after its Curation is replaced. |
| Learnings | What the user should learn, accumulated across applications. |

## Technical constraints

These constraints are product decisions and must be honoured by any implementation.

| ID | Constraint |
| --- | --- |
| TC-01 | Reading files: the Uploaded Resume is a PDF whose text is extracted once and kept. The Candidate's Model reads that stored text and rules verify the reading, grounding every value in the text with a Confidence per field. Reading the résumé again reads the same stored text, never the PDF again. |
| TC-02 | Removed: LinkedIn is not read (#104). |
| TC-03 | Profile building runs **by segment** through a queue: each segment is read, recognised, and saved independently. |
| TC-04 | Profile building is **resumable**: if the process fails, it resumes where it left off. Percentage and progress are visible to the user. |
| TC-05 | A Candidate cannot perform multiple uploads or analyse multiple profiles at the same time: at most one active Ingestion, one active Curation and one active Job Analysis per Account, and no Job Analysis starts while an Ingestion or a Curation is active. An upload or a Curation re-run supersedes a running Job Analysis at its next Layer boundary. |
| TC-06 | All AI analysis layers run **sequentially**. The next one only runs once the previous one has completed. |
| TC-07 | Before any AI analysis, RAG is used to optimise token consumption. |
| TC-08 | Every AI analysis after Profile Curation reads curated **Statements**, never the Profile and never the extracted text (ADR-0024). |
| TC-09 | The Candidate supplies their own **Model Key** for generation; the platform holds no generation key and no balance. Embeddings run on one platform key, the platform's only AI spend (ADR-0023). |

## Open questions

Track these as issues once the GitHub Project is set up.

- What "success rate" means numerically in the preparation summary.
