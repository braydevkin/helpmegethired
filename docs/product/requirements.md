# Requirements

Derived from `arch/hgh.drawio`. When the diagram and this document disagree, this document wins and the diagram should be updated.

## Functional requirements

| ID | Requirement |
| --- | --- |
| FR-01 | Account sign up and sign in with an email and a one-time code sent by email; no passwords. Sign up adds the Account information: name, last name, phone with country code, optional address. |
| FR-02 | Upload a Resume as a PDF of at most 5 MB and 20 pages. The upload is refused with a reason the Candidate can act on when the file is not a PDF, is too large, has too many pages, is password-protected, is damaged, or is a scan without text. |
| FR-03 | Removed: LinkedIn is not read (#104). The Profile is built from the Uploaded Resume alone. |
| FR-04 | Build a candidate profile from the Uploaded Resume: basic profile, experiences, education, projects, skills, languages, certifications. |
| FR-05 | Paste a job description. |
| FR-06 | AI analysis of the job description compared with the profile, including the strengths and weaknesses for that role. Requires a completed Curation, and reads the Candidate's Statements, never the Profile (ADR-0024). |
| FR-07 | AI recommendations for the resume (ATS level and resume rebuild). |
| FR-08 | AI recommendations for studies (learnings and a structured study plan). |
| FR-09 | AI mock interview for the target role. |
| FR-10 | Apply helper: cover letter, updated resume, and study plan for a specific job description. |
| FR-11 | Preparation summary with success rates across all steps. |
| FR-12 | Profile Curation: the confirmed Profile is read once, on the Candidate's own Model Key, into Statements that each carry the Evidence behind them, and the Candidate can accept or reject each Statement. |

## Application flow

The candidate journey is strictly ordered. Each step becomes available only when the previous one is complete.

```
Sign Up / Sign In
  └─ Upload Resume PDF
      └─ Confirm Profile
          └─ Choose the Model and supply the Model Key
              └─ Profile Curation
                  └─ Profile analysis with the evidence behind it
                      └─ Paste Job Description
                          └─ AI Analysis comparing with profile: strengths and weaknesses for that role
                              └─ AI Resume Recommendations
                                  └─ AI Study Recommendations
                                      └─ AI Mock Interview
                                          └─ Preparation summary with all success rates
```

- Profile Curation starts once the Profile is confirmed and a Model Key is stored, whichever comes last (ADR-0024).
- Strengths and weaknesses are not a Profile-level step. A weakness is only a fact when something specific is missing for something specific, so they are produced per Job Description by the layer that holds the target.

## Business logic (AI services)

These are the LangChain tools the LLM can call. They run in this order for a given job description.

| Service | Behaviour |
| --- | --- |
| **Resume ATS Level** | Based on ATS rules, check the user's resume against the specific job description and produce a score from 0 to 10. |
| **Resume Builder** | If the ATS score is below 8, help the user create an updated resume for that job description based on their experiences, projects, and basic profile. |
| **Learning with job applications** | Based on previous job applications, define what the user should learn to improve their chances of getting hired. |
| **Learn with AI** | Based on the user's list of learnings, create a fully structured study plan with content to learn. |
| **Apply Helper** | Send the user a cover letter for the specific job description, together with the resume and the study plan. |

## Domain entities

| Entity | Notes |
| --- | --- |
| Account | Authentication identity. |
| Uploaded Resume | The PDF a Candidate uploaded, its status, and the text extracted from it. The PDF itself is deleted once the text is kept. |
| Basic Profile | Headline, summary, LinkedIn URL, GitHub URL. Name, e-mail, and phone belong to the Account, never to the Profile. |
| Experiences | Work history. Input to Profile Curation. |
| Education | Academic history. |
| Projects | Personal or professional projects. Input to Profile Curation. |
| Skills | Technologies and competences, grouped by category. |
| Languages | Spoken languages with a level. |
| Certifications | Credentials with issuer and year. |
| Statements | Self-contained sentences about the Candidate, each with its Evidence, produced by Profile Curation; embedded for RAG and read by every later AI layer. |
| Job Descriptions | Stored per user; embedded for RAG. |
| Learnings | What the user should learn, accumulated across applications. |

## Technical constraints

These constraints are product decisions and must be honoured by any implementation.

| ID | Constraint |
| --- | --- |
| TC-01 | Reading files: the Uploaded Resume is a PDF whose text is extracted once and kept. In this phase the Profile is recognised from that text by rules with a Confidence per field. LLM extraction is a later step that reads the same stored text, never the PDF again. |
| TC-02 | Removed: LinkedIn is not read (#104). |
| TC-03 | Profile building runs **by segment** through a queue: each segment is read, recognised, and saved independently. |
| TC-04 | Profile building is **resumable**: if the process fails, it resumes where it left off. Percentage and progress are visible to the user. |
| TC-05 | A user cannot perform multiple uploads or analyse multiple profiles at the same time. |
| TC-06 | All AI analysis layers run **sequentially**. The next one only runs once the previous one has completed. |
| TC-07 | Before any AI analysis, RAG is used to optimise token consumption. |
| TC-08 | Every AI analysis after Profile Curation reads curated **Statements**, never the Profile and never the extracted text (ADR-0024). |
| TC-09 | The Candidate supplies their own **Model Key**; the platform holds no generation key and no balance (ADR-0023). |

## Open questions

Track these as issues once the GitHub Project is set up.

- What "success rate" means numerically in the preparation summary.
- Which ATS rule set the score is based on, and whether it is versioned.
