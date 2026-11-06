import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, USER_A, USER_B } from './interview-next-db.mjs';
import { createNextService, validateNextRequest, contextFromSnapshot } from '../lib/interview/next-service.mjs';
import { createNextRepository } from '../lib/interview/next-repository.mjs';
import { createNextHandler } from '../lib/interview/next-http.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { InterviewerError } from '../lib/interview/interviewer-contract.mjs';
import { buildInterviewerRequest } from '../lib/interview/interviewer-prompt.mjs';
import { planQuestion } from '../lib/interview/question-plan.mjs';
import { interviewerFixtures } from '../lib/interview/interviewer-fixtures.mjs';

let store;
before(async () => { store = await createTestDatabase(); });
after(async () => { await store?.db.close(); });
const decision = (label = 'React', action = 'next_topic') => ({ action, question: `How would you test ${label} in this application?`, topic: label, reason: 'Check the implementation trade-off.' });
function service(next, options = {}) {
  return createNextService({ repository: store.repository, provider: { model: 'offline-test', next }, ...options });
}
const request = (body, headers = { 'Content-Type': 'application/json' }) => new Request('http://localhost/api/interview/next', {
  method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('browser contract rejects missing/extra fields and client-supplied context', () => {
  const valid = { sessionId: randomUUID(), afterAnswerId: null };
  assert.deepEqual(validateNextRequest(valid), valid);
  for (const body of [null, [], {}, { sessionId: valid.sessionId }, { ...valid, userId: USER_A },
    { ...valid, settings: {} }, { ...valid, afterAnswerId: 'invalid' }]) {
    assert.throws(() => validateNextRequest(body), { code: 'BAD_INPUT' });
  }
});

test('opening reaches the real provider parser and is saved/replayed without a second AI call', async () => {
  const sessionId = await store.session(); let calls = 0;
  const provider = createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'test-model' },
    fetchImpl: async (_url, options) => {
      calls++;
      const payload = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
      assert.equal(payload.settings.targetPosition, 'Frontend Intern');
      assert.equal(payload.questionPlan.basis, 'jd');
      assert.equal(payload.settings.language, 'vi');
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(decision()) }] } }] });
    },
  });
  const next = createNextService({ repository: store.repository, provider });
  const body = { sessionId, afterAnswerId: null };
  const first = await next(body);
  assert.deepEqual(await next(body), first);
  assert.equal(calls, 1); assert.equal(first.question.position, 1);
  assert.equal(first.question.kind, 'main'); assert.equal('reason' in first, false);
  assert.equal((await store.db.query('select count(*)::int as n from public.questions where session_id=$1', [sessionId])).rows[0].n, 1);
});

test('concurrent requests reserve one turn before calling the AI', async () => {
  const sessionId = await store.session(); let entered; let resume; let calls = 0;
  const started = new Promise((resolve) => { entered = resolve; });
  const wait = new Promise((resolve) => { resume = resolve; });
  const next = service(async () => { calls++; entered(); await wait; return decision(); });
  const body = { sessionId, afterAnswerId: null }; const first = next(body);
  await started;
  await assert.rejects(next(body), { code: 'GENERATION_IN_PROGRESS', status: 409 });
  resume(); await first; assert.equal(calls, 1);
});

test('latest saved answer anchors a follow-up and parent points to its main question', async () => {
  const sessionId = await store.session();
  const opening = await service(async () => decision())({ sessionId, afterAnswerId: null });
  const afterAnswerId = await store.answer(opening.question.id);
  const result = await service(async (context) => {
    assert.equal(context.history.length, 1);
    assert.ok(context.history[0].answer.includes('cancel'));
    return { ...decision('React', 'follow_up'), question: 'What happens when the older request resolves last?' };
  })({ sessionId, afterAnswerId });
  assert.equal(result.question.kind, 'follow_up');
  const row = await store.db.query('select parent_question_id from public.questions where id=$1', [result.question.id]);
  assert.equal(row.rows[0].parent_question_id, opening.question.id);
});

test('wrong answer anchor is rejected without calling AI', async () => {
  const sessionId = await store.session();
  await assert.rejects(service(async () => { assert.fail('AI must not run'); })({ sessionId, afterAnswerId: randomUUID() }), { code: 'STALE_TURN' });
});

test('snapshot still works without linked fit analysis and preserves CV tail', async () => {
  const cv = 'Synthetic project description. '.repeat(1000) + 'TAIL_CV_MARKER';
  const sessionId = await store.session({ cv, type: 'behavioral', language: 'en', difficulty: 'hard' });
  await service(async (context) => {
    assert.ok(context.cvText.endsWith('TAIL_CV_MARKER'));
    assert.equal(context.settings.type, 'behavioral'); assert.equal(context.settings.language, 'en');
    assert.equal(context.settings.difficulty, 'hard'); return decision();
  })({ sessionId, afterAnswerId: null });
});

test('empty JD/CV produces role-based context without invented evidence', async () => {
  const sessionId = await store.session({ jd: '', cv: '', position: 'Backend Intern' });
  await service(async (context) => {
    const plan = planQuestion(context);
    assert.equal(plan.basis, 'role'); assert.equal(plan.jdFocus, null); assert.deepEqual(plan.cvContext, []);
    return decision('Backend concepts');
  })({ sessionId, afterAnswerId: null });
});

test('another user cannot claim, finish, release or read a reservation', async () => {
  const sessionId = await store.session(); const body = { sessionId, afterAnswerId: null };
  const claim = await store.repository.claim(body);
  await store.user(USER_B);
  try {
    await assert.rejects(store.repository.claim(body), { code: 'NOT_FOUND' });
    await assert.rejects(store.repository.finish(body, claim.token, decision(), {}), { code: 'NOT_FOUND' });
    await assert.rejects(store.repository.release(body, claim.token), { code: 'NOT_FOUND' });
    assert.equal((await store.db.query('select session_id from public.interview_next_generations where session_id=$1', [sessionId])).rows.length, 0);
    await assert.rejects(store.db.query("update public.interview_next_generations set status='failed'"));
  } finally { await store.user(USER_A); }
  await store.repository.release(body, claim.token);
});

test('AI failures release a turn for an explicit retry without saving a fake question', async () => {
  const sessionId = await store.session(); const body = { sessionId, afterAnswerId: null }; let calls = 0;
  await assert.rejects(service(async () => { calls++; throw new InterviewerError('AI_RATE_LIMITED', 'Busy', 429); })(body), { code: 'AI_RATE_LIMITED' });
  assert.equal(calls, 1);
  assert.equal((await store.db.query('select count(*)::int as n from public.questions where session_id=$1', [sessionId])).rows[0].n, 0);
  await service(async () => decision())(body);
});

test('invalid provider output is not persisted', async () => {
  const sessionId = await store.session();
  await assert.rejects(service(async () => ({ ...decision(), action: 'end', question: null }))({ sessionId, afterAnswerId: null }), { code: 'INVALID_OUTPUT' });
  assert.equal((await store.db.query('select count(*)::int as n from public.questions where session_id=$1', [sessionId])).rows[0].n, 0);
});

test('expired lease is replaced and stale worker cannot save or release the new reservation', async () => {
  const body = { sessionId: await store.session(), afterAnswerId: null };
  const old = await store.repository.claim(body);
  await store.db.exec('reset role');
  await store.db.query("update public.interview_next_generations set expires_at=now()-interval '1 second' where session_id=$1", [body.sessionId]);
  await store.user();
  const current = await store.repository.claim(body);
  assert.notEqual(current.token, old.token);
  await assert.rejects(store.repository.finish(body, old.token, decision(), {}), { code: 'LEASE_LOST' });
  await store.repository.release(body, old.token);
  assert.equal((await store.repository.claim(body)).kind, 'busy');
  await store.repository.finish(body, current.token, decision(), {});
});

test('time expiry during generation ends the session instead of saving another question', async () => {
  const sessionId = await store.session();
  const result = await service(async () => {
    await store.db.query("update public.interview_sessions set started_at=now()-interval '16 minutes' where id=$1", [sessionId]);
    return decision();
  })({ sessionId, afterAnswerId: null });
  assert.equal(result.action, 'end'); assert.equal(result.question, null);
  assert.equal((await store.db.query('select status from public.interview_sessions where id=$1', [sessionId])).rows[0].status, 'completed');
});

test('closed session and previously pending question need no new AI call', async () => {
  const sessionId = await store.session();
  const first = await service(async () => decision())({ sessionId, afterAnswerId: null });
  await store.db.query("update public.interview_sessions set status='abandoned' where id=$1", [sessionId]);
  const closed = await service(async () => assert.fail('AI must not run'))({ sessionId, afterAnswerId: null });
  assert.equal(closed.action, 'end'); assert.equal(closed.question, null);
  const legacySession = await store.session();
  await store.db.query("insert into public.questions(session_id,position,content,topic) values($1,1,'Existing question?','React')", [legacySession]);
  const pending = await service(async () => assert.fail('AI must not run'))({ sessionId: legacySession, afterAnswerId: null });
  assert.equal(pending.question.content, 'Existing question?'); assert.ok(first.question.id);
});

test('an expired active session does not replay a cached pending question', async () => {
  const sessionId = await store.session();
  await service(async () => decision())({ sessionId, afterAnswerId: null });
  await store.db.query("update public.interview_sessions set started_at=now()-interval '16 minutes' where id=$1", [sessionId]);
  const result = await service(async () => assert.fail('No AI call expected'))({ sessionId, afterAnswerId: null });
  assert.equal(result.action, 'end'); assert.equal(result.question, null);
});

test('context rejects old sessions with missing position or inconsistent history', () => {
  assert.throws(() => contextFromSnapshot({ session: { started_at: 'bad' }, questions: [] }), { code: 'SESSION_CONTEXT_INVALID' });
});

test('a lost commit acknowledgement is recovered on retry without generating again', async () => {
  const body = { sessionId: await store.session(), afterAnswerId: null }; let calls = 0;
  const uncertain = { ...store.repository, finish: async (...args) => {
    await store.repository.finish(...args); throw new Error('Simulated lost response');
  } };
  const next = createNextService({ repository: uncertain, provider: { model: 'test', next: async () => { calls++; return decision(); } } });
  await assert.rejects(next(body), /Simulated lost response/);
  const recovered = await next(body);
  assert.ok(recovered.question.id); assert.equal(calls, 1);
});

test('a definitive persistence rejection releases the reservation for correction/retry', async () => {
  const body = { sessionId: await store.session(), afterAnswerId: null };
  const rejecting = { ...store.repository, finish: async () => { throw new InterviewerError('STALE_TURN', 'Changed turn', 409); } };
  const next = createNextService({ repository: rejecting, provider: { model: 'test', next: async () => decision() } });
  await assert.rejects(next(body), { code: 'STALE_TURN' });
  const claim = await store.repository.claim(body); assert.equal(claim.kind, 'claimed');
  await store.repository.release(body, claim.token);
});

test('the main-question budget ends the session without a Gemini call', async () => {
  const sessionId = await store.session(); let lastAnswer;
  for (let i = 1; i <= 5; i++) {
    const q = await store.db.query('insert into public.questions(session_id,position,content,topic) values($1,$2,$3,$4) returning id',
      [sessionId, i, `Question ${i}?`, `Topic ${i}`]);
    lastAnswer = await store.answer(q.rows[0].id);
  }
  const provider = createInterviewerProvider({ env: {}, fetchImpl: () => assert.fail('No AI call expected') });
  const result = await createNextService({ repository: store.repository, provider })({ sessionId, afterAnswerId: lastAnswer });
  assert.equal(result.action, 'end'); assert.equal(result.question, null);
});

test('SQL rejects null actions and fake end decisions even if called directly', async () => {
  const body = { sessionId: await store.session(), afterAnswerId: null };
  const claim = await store.repository.claim(body);
  for (const value of [{ ...decision(), action: null }, { ...decision(), action: 'end', question: null }]) {
    await assert.rejects(store.repository.finish(body, claim.token, value, {}), { code: 'INVALID_OUTPUT' });
  }
  await store.repository.release(body, claim.token);
});

test('selection adapts to JD and CV; excerpts preserve negation and source wording', () => {
  const base = { ...interviewerFixtures[0].input, history: [], jdText: 'React hooks and REST API. PostgreSQL transactions and concurrent updates.', cvText: 'I have not used React hooks. Built PostgreSQL transactions in a class project.' };
  const plan = planQuestion(base);
  assert.equal(plan.jdFocus, 'React hooks and REST API.');
  assert.ok(plan.cvContext.includes('I have not used React hooks.'));
  const second = planQuestion({ ...base, history: [{ topic: 'React hooks', question: 'How do you use a REST API?' }] });
  assert.equal(second.jdFocus, 'PostgreSQL transactions and concurrent updates.');
  assert.ok(second.cvContext.includes('Built PostgreSQL transactions in a class project.'));
  assert.notEqual(planQuestion({ ...base, jdText: 'Python data processing and pandas.' }).jdFocus, plan.jdFocus);
});

test('JD headings and position-only lines do not outrank assessable short skills', () => {
  const input = { ...interviewerFixtures[0].input, history: [],
    settings: { ...interviewerFixtures[0].input.settings, targetPosition: 'Backend Intern' },
    jdText: 'Vị trí: Backend Intern\nYêu cầu:\n- Go\n- C#',
    cvText: 'Built services with Go. I have not used C#.' };
  const first = planQuestion(input);
  assert.equal(first.jdFocus, '- Go');
  assert.ok(first.cvContext.includes('Built services with Go.'));
  const next = planQuestion({ ...input, history: [{ topic: 'Go', question: 'How would you write a Go service?' }] });
  assert.equal(next.jdFocus, '- C#');
  assert.ok(next.cvContext.includes('I have not used C#.'));
});

test('short standalone CV technologies remain eligible verbatim context', () => {
  const input = { ...interviewerFixtures[0].input, history: [], jdText: 'Go services.', cvText: 'Go.\nC#.' };
  assert.deepEqual(planQuestion(input).cvContext, ['Go.']);
});

test('technical aliases select relevant CV text without rewriting source evidence', () => {
  const input = { ...interviewerFixtures[0].input, history: [], jdText: 'JavaScript development.', cvText: 'Built a JS application.' };
  assert.deepEqual(planQuestion(input).cvContext, ['Built a JS application.']);
});

test('heading-only JD falls back to the saved target position', () => {
  const input = { ...interviewerFixtures[0].input, history: [],
    jdText: 'Requirements:\nSkills:\nFrontend Intern', cvText: '' };
  const plan = planQuestion(input);
  assert.equal(plan.basis, 'role'); assert.equal(plan.jdFocus, null);
});

test('hard behavioral and HR policies do not inherit hypothetical technical design constraints', () => {
  const base = { ...interviewerFixtures[0].input, history: [] };
  const behavioral = planQuestion({ ...base, settings: { ...base.settings, type: 'behavioral', difficulty: 'hard' } });
  assert.match(behavioral.difficultyPolicy, /real past situation/u);
  assert.doesNotMatch(behavioral.difficultyPolicy, /concurrency|hypothetical/u);
  const hr = planQuestion({ ...base, settings: { ...base.settings, type: 'hr', difficulty: 'hard' } });
  assert.match(hr.difficultyPolicy, /professional judgment/u);
  assert.match(hr.difficultyPolicy, /without assuming management experience/u);
});

test('all 18 round/difficulty/language combinations reach prompt policies with intact data', () => {
  for (const type of ['hr', 'technical', 'behavioral']) for (const difficulty of ['easy', 'medium', 'hard']) for (const language of ['vi', 'en']) {
    const base = structuredClone(interviewerFixtures[0].input);
    Object.assign(base.settings, { type, difficulty, language });
    const body = buildInterviewerRequest(base);
    const payload = JSON.parse(body.contents[0].parts[0].text);
    assert.equal(payload.documents.cvText, base.cvText); assert.equal(payload.documents.jdText, base.jdText);
    assert.deepEqual(payload.settings, base.settings);
    assert.ok(payload.questionPlan.roundPolicy); assert.ok(payload.questionPlan.difficultyPolicy);
    assert.ok(body.systemInstruction.parts[0].text.includes('Lexical overlap is not evidence'));
  }
});

test('HTTP authenticates before reading input and hides unknown exception details', async () => {
  const noAuth = createNextHandler({ authenticate: async () => null, makeService: () => assert.fail() });
  const denied = await noAuth(request({})); assert.equal(denied.status, 401);
  const broken = createNextHandler({ authenticate: async () => { throw new Error('private-key database details'); }, makeService: () => assert.fail() });
  const response = await broken(request({})); assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes('private-key'));
});

test('HTTP errors for wrong type, oversized body, malformed JSON and invalid contract', async () => {
  const handler = createNextHandler({ authenticate: async () => ({}), makeService: () => service(async () => decision()) });
  for (const req of [request('{}', { 'Content-Type': 'text/plain' }), request('{bad'), request(' '.repeat(2050)), request({})]) {
    const response = await handler(req); assert.equal(response.status, 400);
  }
});

test('HTTP integration returns a persisted public question with no-store headers', async () => {
  const handler = createNextHandler({ authenticate: async () => ({}), makeService: () => service(async () => decision()) });
  const result = await handler(request({ sessionId: await store.session(), afterAnswerId: null }));
  assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store');
  const body = await result.json(); assert.ok(body.question.id); assert.equal('reason' in body, false);
});

test('missing migration produces a safe actionable 503', async () => {
  const repository = createNextRepository({ rpc: async () => ({ error: { code: 'PGRST202', message: 'private schema details' } }) });
  await assert.rejects(repository.claim({ sessionId: randomUUID(), afterAnswerId: null }), { code: 'DATABASE_NOT_READY', status: 503 });
});

test('generation foreign keys have leading-column indexes for deletion/cascade lookups', async () => {
  const result = await store.db.query(`select a.attname from pg_constraint c
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
    where c.contype='f' and c.conrelid='public.interview_next_generations'::regclass
      and not exists(select 1 from pg_index i where i.indrelid=c.conrelid and i.indkey[0]=a.attnum)`);
  assert.deepEqual(result.rows, []);
});

test('reservation tokens and internal AI decisions cannot be selected through the user role', async () => {
  const body = { sessionId: await store.session(), afterAnswerId: null };
  const claim = await store.repository.claim(body);
  const visible = await store.db.query('select session_id,status,response from public.interview_next_generations where session_id=$1', [body.sessionId]);
  assert.equal(visible.rows[0].status, 'generating');
  for (const column of ['token', 'expires_at', 'decision', 'metadata']) {
    await assert.rejects(store.db.query(`select ${column} from public.interview_next_generations where session_id=$1`, [body.sessionId]), { code: '42501' });
  }
  await store.repository.release(body, claim.token);
});

test('HTTP rejects lookalike JSON media types before creating a service', async () => {
  const handler = createNextHandler({ authenticate: async () => ({}), makeService: () => assert.fail('Must reject the media type first') });
  const response = await handler(request({}, { 'Content-Type': 'application/jsonp' }));
  assert.equal(response.status, 400);
  const body = await response.json(); assert.equal(body.error.code, 'BAD_INPUT');
});

test('anonymous role cannot call any turn reservation RPC', async () => {
  const body = { sessionId: await store.session(), afterAnswerId: null };
  await store.db.exec('reset role; set role anon');
  try {
    await assert.rejects(store.repository.claim(body), { code: 'SERVER_ERROR' });
    const permission = await store.db.query(`select
      has_function_privilege('anon','public.claim_interview_next(uuid,uuid)','execute') as claim,
      has_function_privilege('anon','public.finish_interview_next(uuid,uuid,uuid,jsonb,jsonb)','execute') as finish,
      has_function_privilege('anon','public.release_interview_next(uuid,uuid,uuid)','execute') as release`);
    assert.deepEqual(permission.rows[0], { claim: false, finish: false, release: false });
  } finally { await store.user(); }
});

test('JSON content type still accepts a charset parameter and mixed casing', async () => {
  const handler = createNextHandler({ authenticate: async () => ({}), makeService: () => service(async () => decision()) });
  const response = await handler(request({ sessionId: await store.session(), afterAnswerId: null }, { 'Content-Type': 'Application/JSON; charset=UTF-8' }));
  assert.equal(response.status, 200);
});
