# InterviewBuddy

An AI mock-interview web app for job and internship seekers.

The user pastes a job description (JD) and a CV. An AI interviewer then runs a mock interview tailored to that position: it asks follow-up questions, scores each answer against a fixed rubric, explains weak points, and generates targeted practice questions. Answers can be given by voice (speech-to-text) or by typing, in Vietnamese or English.

Course project for **Introduction to Software Engineering**, University of Science, VNU-HCM.

## Team

| No. | Full name | Student ID | Role |
| --- | --- | --- | --- |
| 1 | | | Team leader |
| 2 | | | |
| 3 | | | |
| 4 | | | |

## Tech stack

- Frontend: Next.js (React) + Tailwind CSS
- Backend / database / auth: Supabase or Firebase (to be decided in Sprint 2)
- AI: Gemini API (Flash models)
- Speech-to-text: browser Web Speech API
- Deployment: Vercel or Netlify

## Repository structure

```
/src                        Source code
/docs
  /management               Project plan, weekly reports, status reports
  /requirements             Vision document, use cases, requirements
  /analysis and design      Architecture document, UML models, UI design
  /test                     Test plan, test cases, test reports
/pa                         Submissions, one subfolder per project assignment
  /PA0                      Group registration and project proposal
  /PA1                      Project plan, vision, UI prototypes, weekly reports
```

## Schedule

| Phase | Sprint | Dates | Assignment |
| --- | --- | --- | --- |
| Inception | 1 | 05/10 – 18/10 | PA0, PA1 |
| Elaboration | 2 | 19/10 – 01/11 | PA2 |
| Elaboration | 3 | 02/11 – 15/11 | PA3 |
| Construction | 4 | 16/11 – 29/11 | PA4 |
| Construction | 5 | 30/11 – 13/12 | PA5 |

## Working conventions

- `main` always holds reviewed work. Do not push directly to `main`.
- Create one branch per Jira task: `feature/<JIRA-KEY>-short-name`, `fix/<JIRA-KEY>-short-name`, or `docs/<JIRA-KEY>-short-name`.
- Start commit messages with the Jira key, e.g. `IB-12: Add JD input form`.
- Open a pull request and get at least one teammate's review before merging.
- Never commit secrets. Put API keys in `.env.local`, which is git-ignored.
- Keep interview recordings and other personal data in the team's shared Drive, not in this repository.
