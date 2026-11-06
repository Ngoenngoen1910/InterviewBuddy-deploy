# Interview Next API v1 — SCRUM-92

Status: implemented locally; requires migration review/application before hosted use.
Source: `src/app/api/interview/next/route.ts`. Internal AI contract remains [v0.1](AI_INTERVIEWER_CONTRACT_v0.1.md); current prompt is v0.8 after SCRUM-93.

## Prerequisite

Apply `src/supabase/migrations/20261103000000_interview_next.sql` after the two existing migrations. It adds a per-turn reservation table and three atomic RPC functions. The migration has been tested locally; it has **not** been applied to the shared Supabase project. Coordinate application with Nhân (SCRUM-79).

Use the configured server `GEMINI_API_KEY`; model order stays `GEMINI_INTERVIEW_MODEL` → `GEMINI_MODEL` → application default. This endpoint reuses the existing REST provider; no SDK or model migration is introduced.

## Request

`POST /api/interview/next`, `Content-Type: application/json`.
Authentication: existing Supabase session cookie, or `Authorization: Bearer <access_token>`, as in [Session API v1](INTERVIEW_SESSION_API_v1.md).

```json
{ "sessionId": "00000000-0000-4000-8000-000000000010", "afterAnswerId": null }
```

Both fields are required. `afterAnswerId: null` requests the opening question. Subsequent turns use the ID of the latest **persisted** answer. The frontend first saves the answer through the persistence integration, then requests the next question. UUIDs above are placeholders, not seeded records. Unknown fields are rejected; do not send user IDs, JD/CV, settings, history or counters. Request bodies are limited to 2048 bytes.

The endpoint does not save answer bodies. The answer-saving API and Chat page must be integrated with SCRUM-79/SCRUM-95. There is no new answer route in this change.

## Public response

```json
{
  "sessionId": "00000000-0000-4000-8000-000000000010",
  "action": "next_topic",
  "question": {
    "id": "00000000-0000-4000-8000-000000000011",
    "content": "How would you handle an outdated API response in React?",
    "topic": "React API requests",
    "kind": "main",
    "position": 1
  }
}
```

For `follow_up`, kind is `follow_up` and `parent_question_id` points to the latest main question. For `end`, question is null. The server retains the operational `reason` in the generation record; the public response contains no reason, score, CV evidence, lease token or credentials. Responses have `Cache-Control: no-store`.

## Context and generation

The atomic claim loads the signed-in user's session snapshot and ordered questions/answers. The service validates settings/history, derives time from `started_at` and uses JD/CV snapshots even if the linked analysis is deleted. The first opening claim sets `started_at` to the actual start of practice. The optional real interview date is not an elapsed-time clock.

`question-plan.mjs` (context version `jd-cv-context-v3`) ranks JD passages by lexical overlap with previous topics, preferring the least-covered passage, and finds up to two relevant verbatim CV passages. It skips standalone section headings and the saved position title, preserves short technologies such as Go/C#, and normalizes selected technology aliases for matching (for example, JS/JavaScript). It does not rewrite source excerpts. This is a transparent heuristic, not a trained knowledge selector, semantic coverage guarantee or proof of competence. Negations remain in excerpts. The full JD/CV stay in the prompt; long passages skipped by the selector are not silently removed from the documents.

The prompt supplies policies for HR/technical/behavioral, easy/medium/hard and vi/en. Difficulty is specific to the interview round: hard technical questions can probe a hypothetical failure or concurrency trade-off; hard behavioral questions invite a real past disagreement or competing priorities and reflection; hard HR questions probe professional judgment without assuming management experience. Missing or heading-only documents use the target position. Technical questions prefer hypothetical wording for techniques not explicitly evidenced in the CV. Behavioral questions invite real past experiences using STAR. Output is validated through the existing schema/policy checks before SQL persists the question.

SCRUM-93 adds bounded conversation memory: only the last four completed question-answer pairs are sent verbatim, with an extractive summary of earlier topics/answers capped at 6000 UTF-16 units of serialized JSON. Full persisted history still controls counts, topic selection and exact normalized duplicate rejection. The summary is rebuilt locally without a second AI call, and is not accepted from the client. Metadata records `memoryVersion: last-four-extractive-v1`. See [flow and context handoff](INTERVIEW_FLOW_CONTEXT_v1.md).

The bounded follow-up/end policy is reused. The latest answer takes priority over selecting a new JD topic: clarify vagueness or a useful unresolved detail while follow-up is allowed; move on from a complete answer with no useful unresolved detail or an explicit refusal. End/time/question limits remain deterministic server decisions. Streaming and first-token latency targets remain SCRUM-94. Scoring and feedback creation are not part of this API; no placeholder scores are inserted into `feedbacks`.

## Retries and concurrency

- The turn key is `(sessionId, afterAnswerId)` or `(sessionId, opening)`. It is independent of a client-generated request ID.
- PostgreSQL serializes reservation/finalization by locking the session row. One active lease lasts 120 seconds; the external call does not hold a database transaction open. This exceeds the provider's maximum configured 45-second timeout.
- While the session is active and within its time limit, repeating a completed turn returns exactly its saved question, even if later questions have since been answered. A client resuming the current interview must use the latest persisted answer ID, not always null. Closed or expired sessions return `end` instead.
- An unanswered legacy question can be returned without generating another one. A closed session returns `end` without an AI call.
- Concurrent callers receive `409 GENERATION_IN_PROGRESS` with `Retry-After: 2`. The UI should keep one request in flight and retry the same turn, not create a new session/answer.
- Provider/validation failure releases the claim for an explicit retry. No billable call is automatically retried. An uncertain commit acknowledgement leaves the claim intact so a retry recovers the saved result or waits for expiry. Expired workers cannot commit or release the replacement worker's lease.
- Finalization rechecks status/time and question count after the external call. Crossing a limit closes the session instead of saving another question.

The reservation is for consistency, not an abuse/rate-limit system. RLS and the definer RPC ownership checks isolate users. Direct authenticated SELECT is limited to session_id, turn_key, after_answer_id, status, question_id and response; internal columns are not exposed by table-level SELECT grants. The authenticated claim RPC intentionally returns a token for the caller's own session. Per-user AI-call budgeting remains a separate integration concern with SCRUM-79.

## Errors

Errors have `{ "error": { "code": "...", "message": "..." } }`.

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | BAD_INPUT | Invalid JSON/type/fields/UUID or oversized request. |
| 401 | UNAUTHORIZED | Missing/invalid sign-in. |
| 404 | NOT_FOUND | Unknown or another user's session. |
| 409 | STALE_TURN | The answer anchor does not match the current turn. Reload session history. |
| 409 | GENERATION_IN_PROGRESS | Same turn is being generated. Retry the same request after a short wait. |
| 409 | LEASE_LOST | Reservation expired/replaced. Reload before retrying. |
| 409 | SESSION_CONTEXT_INVALID | Saved settings/history is inconsistent or exceeds the context budget. |
| 422 | AI_CONTENT_BLOCKED | Provider rejected the content. |
| 429 | AI_RATE_LIMITED | Gemini quota/rate limit. |
| 502 | INVALID_OUTPUT / AI_UNAVAILABLE | Invalid AI result or upstream/network failure. |
| 503 | DATABASE_NOT_READY | Missing Supabase configuration or missing migration/RPC. |
| 503 | AI_NOT_CONFIGURED / AI_CONFIGURATION_ERROR | Missing/invalid server AI configuration. |
| 504 | AI_TIMEOUT | Provider timeout. |
| 408 | REQUEST_CANCELLED | Request cancelled before persistence. |
| 500 | SERVER_ERROR | Other persistence/internal failure; details are not exposed. |

## Research basis and limits

- Li et al., **EZInterviewer**, WSDM 2023, [DOI 10.1145/3539597.3570476](https://doi.org/10.1145/3539597.3570476): inspiration for selecting CV/JD context before question generation. Our lexical heuristic + Gemini does not reproduce their trained architecture.
- Wen et al., **PolyInterview**, arXiv v3 2026, [Appendix C](https://arxiv.org/html/2607.10310v3): personalization and planning; preprint, not an independently reproduced result.
- Daryanto et al., **Conversate**, PACMHCI/GROUP 2025, [§3.2 and Appendix B.1](https://arxiv.org/html/2410.05570v2): separate opening, follow-up and next-main-question purposes.
- Siswanto et al., **Interview Bot Development**, 2022, [§2.1](https://doi.org/10.14716/ijtech.v13i2.5018): STAR for behavioral interviews. Their Indonesian scoring method is not implemented here.

Correct JSON is not evidence of correct relevance, difficulty or factual grounding. Human review is still needed; no paper's reported accuracy, latency or hiring outcomes are claimed for InterviewBuddy.
