# InterviewBuddy

An AI mock-interview web app for job and internship seekers.

The user pastes a job description (JD) and a CV. An AI interviewer then runs a mock interview tailored to that position: it asks follow-up questions, scores each answer against a fixed rubric, explains weak points, and generates targeted practice questions. Answers can be given by voice (speech-to-text) or by typing, in Vietnamese or English.

Course project for **Introduction to Software Engineering**, University of Science, VNU-HCM.

## Team

Group 3, class 24C01.

| No. | Full name | Role |
| --- | --- | --- |
| 1 | Đào Ngọc Chung Nguyên | Team leader – Jira, deployment, use cases, reports |
| 2 | Nguyễn Trần Trung Nhân | Project skeleton, database, architecture, merges PRs |
| 3 | Trần Phước Tài | Shared UI and authentication |
| 4 | Lâm Gia Hưng | AI features (Gemini) |
| 5 | Nguyễn Đặng Hoàng Khang | CV/JD analysis page, vision document |

## Tech stack

- Frontend: Next.js 16 (App Router, TypeScript) + Tailwind CSS 4
- Auth and database: Supabase (PostgreSQL with Row Level Security)
- AI: Gemini API (free Flash model, set in `GEMINI_MODEL`)
- Speech-to-text: browser Web Speech API
- Deployment: Vercel or Netlify

## Getting started

The app lives in `/src`. Setup steps are in [src/README.md](src/README.md). Architecture and database design are in [docs/analysis and design](docs/analysis%20and%20design/).

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

- Nobody pushes directly to `main`, documents included. Every change goes through a pull request.
- Branch names: `feat/<feature>-<name>`, `fix/<feature>-<name>`, `docs/<name>`, e.g. `feat/login-page`.
- Mention the Jira issue (e.g. `SCRUM-29`) in the PR title or description.
- Check that the preview link works before asking for review.
- Nhân merges PRs into `main` (Monday, Wednesday and Friday evenings); Khang is the backup.
- On a conflict, merge `main` into your branch and ask the people involved. Never force-push.
- Never commit secrets. Real keys live only in `.env.local` and the hosting dashboard. Run `git status` before every commit.
- Keep interview recordings and other personal data in the team's shared Drive, not in this repository.

## CV/JD Analysis API — SCRUM-39

The API module in [`src`](src/README.md) accepts CV/JD text and returns a weighted fit score and matched/missing skills.
See the [API contract](docs/api/CV_JD_ANALYSIS_API_v1.md), [handoff for Khang](docs/api/HANDOFF_TO_KHANG.md), and [test report](docs/test/SCRUM-39_TEST_REPORT.md).
Live Gemini verification passed for all five synthetic CV/JD pairs on 23 October 2026 using gemini-3.5-flash-lite. API keys remain in ignored local configuration and are not included in the repository.
