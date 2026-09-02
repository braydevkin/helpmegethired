# Requirements

Derived from `arch/helpmegethired-architecture.drawio`. When the diagram and this document disagree, this document wins and the diagram should be updated.

## Functional requirements

| ID | Requirement |
| --- | --- |
| FR-01 | Account register (sign up / sign in). |
| FR-02 | Upload a resume as PDF. |
| FR-03 | Read a LinkedIn profile from a pasted profile URL. |
| FR-04 | Build a candidate profile from the resume and LinkedIn data: basic profile, experiences, projects. |
| FR-05 | Paste a job description. |
| FR-06 | AI analysis of the job description compared with the profile. |
| FR-07 | AI recommendations for the resume (ATS level and resume rebuild). |
| FR-08 | AI recommendations for studies (learnings and a structured study plan). |
| FR-09 | AI mock interview for the target role. |
| FR-10 | Apply helper: cover letter, updated resume, and study plan for a specific job description. |
| FR-11 | Preparation summary with success rates across all steps. |

## Application flow

The candidate journey is strictly ordered. Each step becomes available only when the previous one is complete.

```
Sign Up / Sign In
  └─ Upload Resume PDF
      └─ Paste LinkedIn URL Profile
          └─ AI Profile Analysis
              └─ Profile Page with strengths and weaknesses
                  └─ Paste Job Description
                      └─ AI Analysis comparing with profile
                          └─ AI Resume Recommendations
                              └─ AI Study Recommendations
                                  └─ AI Mock Interview
                                      └─ Preparation summary with all success rates
```

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
| Basic Profile | Name, headline, summary, and other profile-level data. |
| Experiences | Work history. Input to ATS scoring and resume building. |
| Projects | Personal or professional projects. Input to resume building. |
| Job Descriptions | Stored per user; embedded for RAG. |
| Learnings | What the user should learn, accumulated across applications. |

## Technical constraints

These constraints are product decisions and must be honoured by any implementation.

| ID | Constraint |
| --- | --- |
| TC-01 | Reading files: resume input is a PDF that must be parsed. |
| TC-02 | Reading LinkedIn via API. |
| TC-03 | Profile building runs **by segment** through a queue: each segment is read, recognised, and saved independently. |
| TC-04 | Profile building is **resumable**: if the process fails, it resumes where it left off. Percentage and progress are visible to the user. |
| TC-05 | A user cannot perform multiple uploads or analyse multiple profiles at the same time. |
| TC-06 | All AI analysis layers run **sequentially**. The next one only runs once the previous one has completed. |
| TC-07 | Before any AI analysis, RAG is used to optimise token consumption. |

## Open questions

Track these as issues once the GitHub Project is set up.

- LinkedIn API access: which API, what data is available, and what the fallback is if access is not granted.
- Which LLM provider(s) are used behind LangChain, and whether the choice is configurable.
- What "success rate" means numerically in the preparation summary.
- Which ATS rule set the score is based on, and whether it is versioned.
