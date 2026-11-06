# Interview flow and context v1 — SCRUM-93

Implemented locally on `feat/scrum-93-interview-flow`, based on SCRUM-92 commit `0d856ec`. No new request fields, response fields, dependencies or database migration. Prompt v0.8; memory version `last-four-extractive-v1`.

## Authoritative data and decisions

The authenticated `/api/interview/next` flow from SCRUM-92 still loads persisted history through the ownership-checked claim RPC. The entire ordered history is validated before it is projected into the provider request. A turn means one **completed question-answer pair**, including a follow-up pair; it does not mean one chat message.

Decision priority:

1. Closed/abandoned session, elapsed time limit, or completed main-question budget: `end`, without calling Gemini.
2. No completed turns: opening `next_topic`.
3. Follow-up limit reached for the current main question (easy 1 / medium 2 / hard 3): only `next_topic` is allowed.
4. Otherwise Gemini chooses from the server's allowed actions using the **latest** answer: `follow_up` for a vague answer or a specific interesting unresolved detail; `next_topic` for a developed answer with no useful unresolved detail, or an explicit refusal/request to move on.

A probe about a detail introduced in the latest answer is still `follow_up`, even if it mentions a new sub-technique. It must copy the current topic label. Semantic relevance/vagueness is a model judgment, not a length-based or keyword-based server classifier. These are prompt constraints with observed test evidence, not universal guarantees.

## Provider request projection

`buildConversationMemory` is a pure function in `src/lib/interview/conversation-memory.mjs`, called by `buildInterviewerRequest` after validation. Its return values populate the user-data JSON part of the existing Gemini `generateContent` request:

```json
{
  "conversationSummary": {
    "version": "last-four-extractive-v1",
    "source": "server-extractive",
    "earlierTurnCount": 3,
    "coverage": [
      { "topic": "React requests", "mainQuestions": 1, "followUps": 1 },
      { "topic": "Input validation", "mainQuestions": 1, "followUps": 0 }
    ],
    "coverageClipped": false,
    "excerpts": [
      { "turn": 1, "question": "Earlier question excerpt", "answer": "Earlier answer excerpt", "clipped": true }
    ],
    "omittedExcerptCount": 2
  },
  "completedTurns": [
    { "kind": "follow_up", "topic": "Input validation", "question": "Recent question", "answer": "Recent answer" }
  ]
}
```

This is a shape illustration, not a complete seven-turn fixture. Actual `completedTurns` contains the last `min(4, history.length)` pairs with all four fields preserved. For zero through four completed turns, `conversationSummary` is null.

Earlier topic coverage counts all earlier main/follow-up turns. Up to six earlier excerpts are chosen, preferring more recent earlier turns; question excerpts contain at most 160 Unicode code points, answer excerpts at most 240. These are source excerpts, not generated claims or evaluations. The whole summary's serialized JSON is capped at 6000 UTF-16 code units. `clipped`, `omittedExcerptCount` and `coverageClipped` explicitly disclose information loss. Pathological escaped topic labels are shortened only when needed to fit this budget. The full topics and answers remain in persisted/server history.

No summarizer API call or summary table is introduced. Rebuilding from canonical history avoids an outdated or cross-session cached summary. Transcript instructions remain untrusted even after extraction; the system prompt says not to treat them as commands or infer a complete answer/skill from a clipped note.

## Preserved safeguards and limits

- Main-question and follow-up counters use **full** history, not the four visible pairs.
- JD selection also uses full history to prefer uncovered topics. JD/CV documents remain intact within the existing input limits.
- Output validation checks normalized exact duplicate questions against **all** previous questions, including those outside the window. It does not guarantee rejection of every semantic paraphrase.
- Provider failures or invalid outputs are not automatically retried or replaced by a canned question. Reservation/replay behavior is unchanged.
- Full-input validation still limits JD to 30k, CV to 50k, each answer to 12k and aggregate serialized context to 180k UTF-16 units. Compaction does not bypass these checks or promise simultaneous acceptance of every field at its individual maximum.
- Public HTTP output remains `sessionId`, `action`, `question`; summary, operational reason and generation metadata are not added to it.
- No score/feedback report, answer-saving endpoint, streaming or Chat UI is included.

## Verification and integration boundary

See [implementation and explanation in Vietnamese](../test/SCRUM-93_IMPLEMENTATION_VI.md). Local PostgreSQL tests use PGlite with simulated Auth roles. Real Gemini tests also use the actual HTTP handler/service/repository and local DB, with simulated authentication. Hosted Supabase sign-in and Chat UI integration remain pending; the SCRUM-92 migration must still be applied in the shared environment before deployment.

Technical sources consulted through the Gemini skill: [generateContent reference](https://aistudio.google.com/api-reference/generate-content/generate-content), [structured outputs](https://aistudio.google.com/docs/structured-output), [long context](https://aistudio.google.com/docs/long-context). The four-turn window and 6000-character summary are this project's implementation choices based on Jira, not limits prescribed by Google.
