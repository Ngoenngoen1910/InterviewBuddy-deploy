import { mkdir, writeFile } from 'node:fs/promises';
import { createTestDatabase } from '../tests/interview-next-db.mjs';
import { createNextService } from '../lib/interview/next-service.mjs';
import { createNextHandler } from '../lib/interview/next-http.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { PROMPT_VERSION } from '../lib/interview/interviewer-prompt.mjs';
import { CONVERSATION_MEMORY_VERSION } from '../lib/interview/conversation-memory.mjs';
import { interviewFlowFixtures } from '../lib/interview/interview-flow-fixtures.mjs';
import { validateInterviewerInput } from '../lib/interview/interviewer-contract.mjs';

const args = process.argv.slice(2);
const selected = args.includes('--case') ? args[args.indexOf('--case') + 1] : null;
const allowed = new Set(['--case', '--live', ...(selected ? [selected] : [])]);
if (args.some((arg) => !allowed.has(arg)) || (args.includes('--case') && !interviewFlowFixtures.some((entry) => entry.id === selected))) {
  throw new Error(`Use [--live] [--case <id>]. IDs: ${interviewFlowFixtures.map((entry) => entry.id).join(', ')}`);
}
const cases = selected ? interviewFlowFixtures.filter((entry) => entry.id === selected) : interviewFlowFixtures;
const live = args.includes('--live');
const directory = new URL('../../docs/test/results/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const entry of cases) validateInterviewerInput(entry.input);
if (!live) {
  await writeFile(new URL('scrum93-flow-prepared.json', directory), JSON.stringify({ mode: 'prepared', provenance: 'AI-authored synthetic data', cases }, null, 2));
  console.log(`Prepared ${cases.length} synthetic cases. --live uses Gemini quota.`);
} else {
  const store = await createTestDatabase();
  let externalRequests = 0; let lastPayload = null; let stopped = false;
  const results = [];
  const provider = createInterviewerProvider({ fetchImpl: (_url, options) => {
    externalRequests++;
    lastPayload = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
    return fetch(_url, options);
  } });
  const handler = createNextHandler({ authenticate: async () => ({ local: true }),
    makeService: () => createNextService({ repository: store.repository, provider }) });
  const send = (body) => handler(new Request('http://localhost/api/interview/next', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  try {
    for (const entry of cases) {
      if (stopped) { results.push({ id: entry.id, status: 'skipped' }); continue; }
      const input = validateInterviewerInput(entry.input);
      const sessionId = await store.session({ type: input.settings.type, difficulty: input.settings.difficulty,
        language: input.settings.language, position: input.settings.targetPosition, jd: input.jdText, cv: input.cvText });
      await store.db.query(`update public.interview_sessions set duration_minutes=$2, planned_questions=$3,
        status=$4, started_at=clock_timestamp()-make_interval(secs=>$5) where id=$1`,
      [sessionId, input.settings.durationMinutes, input.settings.plannedQuestions, input.state.status, input.state.elapsedSeconds]);
      let afterAnswerId = null; let parent = null;
      for (const [index, turn] of input.history.entries()) {
        const row = await store.db.query(`insert into public.questions(session_id,position,kind,topic,content,parent_question_id)
          values($1,$2,$3,$4,$5,$6) returning id`, [sessionId, index + 1, turn.kind, turn.topic, turn.question, turn.kind === 'main' ? null : parent]);
        if (turn.kind === 'main') parent = row.rows[0].id;
        afterAnswerId = await store.answer(row.rows[0].id, turn.answer);
      }
      const requestsBefore = externalRequests; lastPayload = null;
      const start = performance.now();
      const response = await send({ sessionId, afterAnswerId });
      const output = await response.json();
      const elapsedMs = Math.round(performance.now() - start);
      const generationRequests = externalRequests - requestsBefore;
      let replaySameResult = false;
      if (response.ok) {
        const replayBefore = externalRequests;
        const replay = await send({ sessionId, afterAnswerId });
        replaySameResult = replay.ok && JSON.stringify(await replay.json()) === JSON.stringify(output) && externalRequests === replayBefore;
      }
      const actionMatchesExpectation = entry.expectedActions.includes(output.action);
      results.push({ id: entry.id, purpose: entry.purpose, input, expectedActions: entry.expectedActions,
        httpStatus: response.status, status: response.ok && replaySameResult ? 'valid-output' : 'error',
        actionMatchesExpectation, elapsedMs, generationRequests, replaySameResult, output,
        promptTrace: lastPayload && {
          recentTurns: lastPayload.completedTurns, summary: lastPayload.conversationSummary, serverPolicy: lastPayload.serverPolicy,
          originalHistoryCharacters: JSON.stringify(input.history).length,
          sentHistoryCharacters: JSON.stringify({ completedTurns: lastPayload.completedTurns, conversationSummary: lastPayload.conversationSummary }).length,
        }, needsIndependentContentReview: true });
      console.log(`${entry.id}: HTTP ${response.status}, action=${output.action ?? output.error?.code}, expected=${actionMatchesExpectation}, calls=${generationRequests}, replay=${replaySameResult}`);
      if (!response.ok || !replaySameResult) stopped = true;
      if (!response.ok || !replaySameResult || !actionMatchesExpectation) process.exitCode = 1;
    }
  } finally {
    await store.db.close();
    await writeFile(new URL(`scrum93-flow-live${selected ? '-' + selected : ''}.json`, directory), JSON.stringify({
      checkedAt: new Date().toISOString(), model: provider.model, promptVersion: PROMPT_VERSION,
      memoryVersion: CONVERSATION_MEMORY_VERSION, externalRequests,
      boundary: 'Actual Gemini + actual HTTP handler/service/repository + local PGlite; simulated authentication; no hosted migration or UI integration.',
      provenance: 'AI-authored synthetic profiles/JDs/answers. Expected semantic actions are fixture expectations, not an independent expert benchmark.',
      results,
    }, null, 2));
  }
}
