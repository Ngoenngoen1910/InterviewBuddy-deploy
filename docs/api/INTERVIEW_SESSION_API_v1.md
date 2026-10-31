# Interview Session API – v1

Owner: Nguyen Tran Trung Nhan · Jira: SCRUM-56, SCRUM-57 · Use case: UC-05 Set up mock interview · Status: **ready for review**

Consumers: Tài (`/interview/new` Setup page, connected in week 5), Khang (saving the CV/JD analysis), Hưng (interview engine in week 5).

Code: `src/app/api/interview/route.ts`, `src/app/api/interview/[id]/route.ts`, `src/lib/interview/session-contract.mjs` (validation and TypeScript types).

## 1. Authentication

Both endpoints need a signed-in user. Either:

- **In the app:** nothing to do. The browser sends the Supabase session cookie automatically.
- **In Postman / curl / scripts:** send `Authorization: Bearer <access_token>` (the Supabase access token of the user).

The user is always taken from the session on the server. The body never contains a user id.

## 2. POST /api/interview – create a session

Request (`Content-Type: application/json`):

```json
{
  "type": "behavioral",
  "difficulty": "medium",
  "language": "vi",
  "targetPosition": "Frontend Intern",
  "interviewDate": "2026-11-20",
  "durationMinutes": 30,
  "inputMode": "text"
}
```

| Field | Type | Required | Allowed values / rule |
| --- | --- | --- | --- |
| `type` | string | yes | `"hr"`, `"technical"`, `"behavioral"` |
| `difficulty` | string | yes | `"easy"`, `"medium"`, `"hard"` |
| `language` | string | yes | `"vi"`, `"en"` |
| `targetPosition` | string | yes | 1–120 characters after trimming |
| `interviewDate` | string or null | no | `YYYY-MM-DD`, today or later (Vietnam time). Omit or `null` if unknown. |
| `durationMinutes` | number | yes | `15`, `30`, `45` |
| `inputMode` | string | yes | `"text"`, `"voice"` |
| `fitAnalysisId` | string or null | no | **Omit** to link the user's latest saved analysis (UC-05 step 13). `null` for no analysis. A UUID to link that analysis (must belong to the user). |

Any other field name is rejected, so a typo such as `duration` instead of `durationMinutes` is caught immediately.

The server derives the number of main questions from the duration: 15 min → 5, 30 min → 8, 45 min → 12.

Responses:

```json
201 Created
{ "sessionId": "3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b", "fitAnalysisId": "00000000-0000-4000-8000-00000000a001" }
```

```json
400 Bad Request
{
  "error": {
    "code": "BAD_INPUT",
    "message": "Some interview settings are missing or invalid.",
    "fields": { "targetPosition": "Required.", "durationMinutes": "Must be one of: 15, 30, 45." }
  }
}
```

`fields` maps each invalid field to its problem, so the Setup page can highlight them (UC-05 alternative flow 2).

| Status | `error.code` | When |
| --- | --- | --- |
| 201 | – | Session created |
| 400 | `BAD_INPUT` | Missing/invalid field, unknown field, past interview date, invalid JSON, or `fitAnalysisId` not found for this user |
| 401 | `UNAUTHORIZED` | Not signed in, or invalid/expired token |
| 500 | `SERVER_ERROR` | Database error. Show a message and keep the form filled in (UC-05 alternative flow 5). |

## 3. GET /api/interview/{id} – read a session

```json
200 OK
{
  "id": "3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b",
  "status": "in_progress",
  "createdAt": "2026-10-30T10:15:00.000Z",
  "settings": {
    "type": "behavioral",
    "difficulty": "medium",
    "language": "vi",
    "targetPosition": "Frontend Intern",
    "interviewDate": "2026-11-20",
    "durationMinutes": 30,
    "inputMode": "text",
    "plannedQuestions": 8
  },
  "analysis": {
    "id": "00000000-0000-4000-8000-00000000a001",
    "fitScore": 72,
    "language": "vi",
    "createdAt": "2026-10-29T08:00:00.000Z",
    "result": { "fitScore": 72, "matched": [], "missing": [], "requirements": [], "recommendation": "..." }
  }
}
```

`analysis` is `null` when no analysis is linked. `result` is the `/api/analyze-fit` response that was saved.

| Status | `error.code` | When |
| --- | --- | --- |
| 200 | – | The session belongs to the signed-in user |
| 401 | `UNAUTHORIZED` | Not signed in |
| 404 | `NOT_FOUND` | No such session, **or it belongs to another user**, or the id is not a UUID |

Another user's session returns 404, not 403, so nobody can tell whether a session id exists.

## 4. Saving the CV/JD analysis (for Khang, SCRUM-72)

Decision (week-4 guide, section 5.1): the analysis is saved **on its own** in `fit_analyses`, tied to the user, because it happens before a session exists. When a session is created, the API links the latest one.

After `/api/analyze-fit` succeeds, save the result from the `/analysis` page with the browser Supabase client. Row Level Security fills in and checks the user automatically:

```ts
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
const { data, error } = await supabase
  .from("fit_analyses")
  .insert({
    jd_text: jd,                 // at most 3000 characters (database check)
    cv_text: cvText,
    cv_file_name: file?.name ?? null,
    language,                    // "vi" | "en"
    fit_score: result.fitScore,  // 0–100
    result,                      // the whole /api/analyze-fit response
  })
  .select("id")
  .single();
// data.id is the fitAnalysisId. Optional: pass it to POST /api/interview.
```

Privacy note for the notice on the page: the **PDF file** is not stored, but the **extracted CV text** is stored with the analysis so the interview can use it. The user can delete it (UC-17).

## 5. Database

Migration `src/supabase/migrations/20261030000000_interview_session_settings.sql` adds `target_position`, `interview_date`, `duration_minutes` and `input_mode` to `interview_sessions`. It also stops a session from being linked to another user's analysis at the database level. See `docs/analysis and design/database-design.md`.

## 6. How to test

```bash
npm test                     # 12 unit tests for validation and mapping (no network)
npm run seed                 # creates candidate.a / candidate.b@interviewbuddy.test with sample data
npm run dev                  # in another terminal
npm run test:session-api     # 8 end-to-end checks, including user B reading user A's session
```

`npm run test:session-api` covers the four checks of the week-4 guide: create (201), missing field (400), not signed in (401), and cross-user access (404). It also covers linking the latest analysis, linking another user's analysis (400), `fitAnalysisId: null`, and an invalid id. Set `API_BASE_URL` to test the staging site instead of localhost.

curl example:

```bash
curl -X POST http://localhost:3000/api/interview \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"technical","difficulty":"medium","language":"en","targetPosition":"Frontend Intern","durationMinutes":30,"inputMode":"text"}'
```

## Change log

| Date | Version | Change |
| --- | --- | --- |
| 30/10/2026 | 1.0 | First version |
