// Synthetic local DB + actual HTTP handler; --live explicitly calls Gemini.
// Authentication is simulated locally. No shared Supabase project is modified.
import { mkdir, writeFile } from 'node:fs/promises';
import { createTestDatabase } from '../tests/interview-next-db.mjs';
import { createNextService } from '../lib/interview/next-service.mjs';
import { createNextHandler } from '../lib/interview/next-http.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { PROMPT_VERSION } from '../lib/interview/interviewer-prompt.mjs';
import { planQuestion, QUESTION_PLAN_VERSION } from '../lib/interview/question-plan.mjs';

const allCases = [
  { id: 'technical-medium-vi', type: 'technical', difficulty: 'medium', language: 'vi', position: 'Frontend Intern',
    jd: 'Frontend Intern: sử dụng React, REST API, xử lý trạng thái tải và lỗi, kiểm thử giao diện.',
    cv: 'Hồ sơ giả lập: đã xây dựng ứng dụng danh sách công việc bằng React và gọi REST API. Chưa có kinh nghiệm làm việc chuyên nghiệp.' },
  { id: 'technical-hard-en', type: 'technical', difficulty: 'hard', language: 'en', position: 'Backend Developer',
    jd: 'Backend Developer: Node.js, PostgreSQL transactions, concurrent requests and integration testing.',
    cv: 'Synthetic profile: built a Node.js inventory project with PostgreSQL transactions. No production experience is claimed.' },
  { id: 'behavioral-easy-vi', type: 'behavioral', difficulty: 'easy', language: 'vi', position: 'Software Engineer Intern',
    jd: 'Software Engineer Intern: phối hợp nhóm, giao tiếp rõ ràng, chủ động xử lý lỗi và kiểm tra kết quả.',
    cv: 'Hồ sơ minh họa: tham gia bài tập nhóm xây dựng website. Không cung cấp thông tin nhận dạng hoặc thành tích cụ thể.' },
  { id: 'hr-medium-en', type: 'hr', difficulty: 'medium', language: 'en', position: 'QA Intern',
    jd: 'Position: QA Intern\nRequirements:\nCommunicate clearly with developers and report reproducible bugs. Collaborate on test planning.',
    cv: 'Synthetic profile: tested a class project and wrote bug reports. No employer, certification or professional experience is claimed.' },
  { id: 'technical-easy-vi-short-skills', type: 'technical', difficulty: 'easy', language: 'vi', position: 'Backend Intern',
    jd: 'Vị trí: Backend Intern\nYêu cầu:\n- Go\n- C#\n- REST API',
    cv: 'Hồ sơ giả lập: đã viết một chương trình nhỏ bằng Go. Chưa sử dụng C#.' },
  { id: 'behavioral-hard-en', type: 'behavioral', difficulty: 'hard', language: 'en', position: 'Software Engineer Intern',
    jd: 'Software Engineer Intern\nResponsibilities:\nCollaborate on debugging, explain trade-offs and communicate disagreements constructively.',
    cv: 'Synthetic profile: participated in a team website assignment. No leadership title or measurable team outcome is provided.' },
];
const caseIndex = process.argv.indexOf('--case');
const selectedId = caseIndex < 0 ? null : process.argv[caseIndex + 1];
if (caseIndex >= 0 && !allCases.some((fixture) => fixture.id === selectedId)) {
  throw new Error(`Choose a valid --case: ${allCases.map((fixture) => fixture.id).join(', ')}`);
}
const cases = selectedId ? allCases.filter((fixture) => fixture.id === selectedId) : allCases;
const live = process.argv.includes('--live');
const directory = new URL('../../docs/test/results/', import.meta.url);
await mkdir(directory, { recursive: true });
if (!live) {
  await writeFile(new URL('scrum92-next-prepared.json', directory), JSON.stringify({ mode: 'prepared', provenance: 'AI-authored synthetic cases', cases }, null, 2));
  console.log(`Prepared ${cases.length} synthetic cases. Use --live to call Gemini (uses quota).`);
} else {
  const store = await createTestDatabase();
  const results = [];
  let externalRequests = 0;
  const provider = createInterviewerProvider({ fetchImpl: (...args) => { externalRequests++; return fetch(...args); } });
  let stopped = false;
  const handler = createNextHandler({ authenticate: async () => ({ local: true }), makeService: () => createNextService({ repository: store.repository, provider }) });
  try {
    for (const fixture of cases) {
      if (stopped) { results.push({ id: fixture.id, status: 'skipped' }); continue; }
      const sessionId = await store.session(fixture);
      const start = performance.now();
      const response = await handler(new Request('http://localhost/api/interview/next', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, afterAnswerId: null }),
      }));
      const body = await response.json();
      const elapsedMs = Math.round(performance.now() - start);
      let replaySameQuestion = false;
      if (response.ok) {
        const beforeReplay = externalRequests;
        const replay = await handler(new Request('http://localhost/api/interview/next', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, afterAnswerId: null }),
        }));
        const repeated = await replay.json();
        replaySameQuestion = replay.ok && repeated.question?.id === body.question?.id && externalRequests === beforeReplay;
      }
      const contextPlan = planQuestion({ jdText: fixture.jd, cvText: fixture.cv, history: [],
        settings: { targetPosition: fixture.position, type: fixture.type, difficulty: fixture.difficulty } });
      const result = { id: fixture.id, status: response.ok && replaySameQuestion ? 'valid-output' : 'error', httpStatus: response.status,
        elapsedMs, replaySameQuestion, contextPlan, input: fixture, output: body };
      results.push(result);
      console.log(`${fixture.id}: ${response.status} ${result.elapsedMs}ms`);
      if (!response.ok || !replaySameQuestion) { stopped = true; process.exitCode = 1; }
    }
  } finally {
    await store.db.close();
    await writeFile(new URL('scrum92-next-live.json', directory), JSON.stringify({
      checkedAt: new Date().toISOString(), promptVersion: PROMPT_VERSION, contextVersion: QUESTION_PLAN_VERSION,
      mode: 'live', model: provider.model, externalRequests,
      boundary: 'Real Gemini + local PGlite database + real HTTP handler, simulated authentication. No hosted migration or UI integration.',
      provenance: 'AI-authored synthetic CV/JD; no real applicant data. Valid-output checks structure, not independent quality.', results,
    }, null, 2));
  }
}
