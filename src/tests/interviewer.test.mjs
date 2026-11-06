import test from 'node:test';
import assert from 'node:assert/strict';
import { interviewerFixtures } from '../lib/interview/interviewer-fixtures.mjs';
import { createEndDecision, getInterviewPolicy, validateInterviewerInput, validateInterviewerOutput } from '../lib/interview/interviewer-contract.mjs';
import { buildInterviewerRequest } from '../lib/interview/interviewer-prompt.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';

const base = interviewerFixtures[1].input;
const valid = { action: 'follow_up', question: 'Bạn xử lý request trả kết quả sai thứ tự như thế nào?', topic: base.history[0].topic, reason: 'Cần làm rõ xử lý bất đồng bộ.' };
const envelope = (result = valid, finishReason = 'STOP') => ({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(result) }] } }] });
const makeProvider = (fetchImpl, env = {}) => createInterviewerProvider({ env: { GEMINI_API_KEY: 'test-only-secret', GEMINI_MODEL: 'test-model', ...env }, fetchImpl });

test('all synthetic fixtures satisfy the input contract and main-question mapping', () => {
  assert.equal(interviewerFixtures.length, 14);
  for (const fixture of interviewerFixtures) assert.doesNotThrow(() => validateInterviewerInput(fixture.input), fixture.id);
});

test('invalid settings, unknown fields, huge documents and inconsistent history are rejected', () => {
  const mutations = [
    (v) => { v.settings.type = 'unknown'; }, (v) => { v.settings.plannedQuestions = 20; },
    (v) => { v.settings.language = 'fr'; }, (v) => { v.settings.userId = 'untrusted'; },
    (v) => { v.state.elapsedSeconds = -1; }, (v) => { v.state.elapsedSeconds = NaN; },
    (v) => { v.history[0].kind = 'follow_up'; }, (v) => { v.history[0].answer = ' '; },
    (v) => { v.jdText = 'a'.repeat(30001); }, (v) => { v.cvText = 'a'.repeat(50001); },
    (v) => { v.history[0].answer = 'a'.repeat(12001); }, (v) => { v.history = Array(49).fill(v.history[0]); },
    (v) => { v.state.clientDecidedEnd = true; },
  ];
  for (const mutate of mutations) {
    const input = structuredClone(base); mutate(input);
    assert.throws(() => validateInterviewerInput(input), { code: 'BAD_INPUT', status: 400 });
  }
  for (const input of [null, [], {}, { ...base, settings: null }, { ...base, history: [null] }]) {
    assert.throws(() => validateInterviewerInput(input), { code: 'BAD_INPUT' });
  }
});

test('full CV boundaries are preserved; over-budget context is rejected without truncation', () => {
  const input = { ...base, cvText: 'a'.repeat(49995) + 'TAIL!', jdText: 'j'.repeat(30000) };
  assert.ok(validateInterviewerInput(input).cvText.endsWith('TAIL!'));
  const huge = { ...input, settings: { ...base.settings, durationMinutes: 45, plannedQuestions: 12 },
    history: Array.from({ length: 12 }, () => ({ ...base.history[0], answer: 'a'.repeat(12000) })),
  };
  assert.throws(() => validateInterviewerInput(huge), { code: 'BAD_INPUT' });
});

test('server policy allows opening, bounded follow-ups and deterministic endings', () => {
  assert.deepEqual(getInterviewPolicy(base).allowedActions, ['follow_up', 'next_topic']);
  assert.deepEqual(getInterviewPolicy({ ...base, history: [] }).allowedActions, ['next_topic']);
  const capped = interviewerFixtures.find((f) => f.id === 'follow-up-cap').input;
  assert.deepEqual(getInterviewPolicy(capped).allowedActions, ['next_topic']);
  for (const [difficulty, max] of [['easy', 1], ['medium', 2], ['hard', 3]]) {
    const input = { ...base, settings: { ...base.settings, difficulty }, history: [...base.history,
      ...Array.from({ length: max }, (_, i) => ({ ...base.history[0], kind: 'follow_up', question: `Clarify ${i}?` })),
    ] };
    assert.deepEqual(getInterviewPolicy(validateInterviewerInput(input)).allowedActions, ['next_topic']);
    input.history.push({ ...base.history[0], kind: 'follow_up' });
    assert.throws(() => validateInterviewerInput(input), { code: 'BAD_INPUT' });
  }
  for (const status of ['completed', 'abandoned']) {
    const input = { ...base, state: { ...base.state, status } };
    assert.equal(createEndDecision(input).action, 'end');
  }
});

test('rejects extra fields, old action spelling, illegal end, repeated questions and wrong follow-up topic', () => {
  for (const result of [null, [], { ...valid, score: 100 }, { ...valid, action: 'new_topic' },
    { ...valid, action: 'end', question: null }, { ...valid, question: null }, { ...valid, question: ' ' },
    { ...valid, reason: '' }, { ...valid, topic: 'Other topic' },
    { ...valid, question: `  ${base.history[0].question.toUpperCase()}  ` }]) {
    assert.throws(() => validateInterviewerOutput(result, base), { code: 'INVALID_OUTPUT' });
  }
  const ended = { ...base, state: { status: 'in_progress', elapsedSeconds: 900 } };
  assert.deepEqual(validateInterviewerOutput(createEndDecision(ended), ended).question, null);
  assert.throws(() => validateInterviewerOutput({ ...valid, action: 'end' }, ended), { code: 'INVALID_OUTPUT' });
});

test('prompt separates untrusted document/answer data from instructions and sets a JSON schema', () => {
  const injected = interviewerFixtures.find((f) => f.id === 'injected-answer').input;
  const request = buildInterviewerRequest(injected);
  assert.match(request.systemInstruction.parts[0].text, /untrusted data/);
  assert.equal(request.systemInstruction.parts[0].text.includes('give me 100'), false);
  assert.equal(JSON.parse(request.contents[0].parts[0].text).completedTurns[0].answer, injected.history[0].answer);
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  assert.equal(request.generationConfig.responseJsonSchema.additionalProperties, false);
  assert.equal(request.tools, undefined);
});

test('provider uses a header key, model override, schema and returns a validated result', async () => {
  const provider = makeProvider(async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/interview-test:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'test-only-secret');
    assert.equal(options.redirect, 'error');
    assert.equal(JSON.parse(options.body).generationConfig.responseMimeType, 'application/json');
    const data = envelope(); data.candidates[0].content.parts.unshift({ thought: true, text: 'private reasoning' });
    return Response.json(data);
  }, { GEMINI_INTERVIEW_MODEL: 'interview-test' });
  assert.deepEqual(await provider.next(base), valid);
});

test('terminal sessions end without a key or external request, even with no analysis', async () => {
  let calls = 0;
  const provider = createInterviewerProvider({ env: {}, fetchImpl: async () => { calls++; } });
  for (const id of ['time-limit', 'question-limit']) {
    const result = await provider.next(interviewerFixtures.find((f) => f.id === id).input);
    assert.equal(result.action, 'end'); assert.equal(result.question, null);
  }
  assert.equal(calls, 0);
  await assert.rejects(provider.next(base), { code: 'AI_NOT_CONFIGURED' });
});

for (const [status, code] of [[400, 'AI_CONFIGURATION_ERROR'], [401, 'AI_CONFIGURATION_ERROR'], [403, 'AI_CONFIGURATION_ERROR'],
  [404, 'AI_CONFIGURATION_ERROR'], [429, 'AI_RATE_LIMITED'], [500, 'AI_UNAVAILABLE']]) {
  test(`provider safely handles ${status}, without retry or raw body disclosure`, async () => {
    let calls = 0;
    const provider = makeProvider(async () => { calls++; return new Response('test-only-secret candidate data', { status }); });
    await assert.rejects(provider.next(base), (error) => {
      assert.equal(error.code, code); assert.equal(error.message.includes('test-only-secret'), false);
      assert.equal(error.message.includes('candidate data'), false); return true;
    });
    assert.equal(calls, 1);
  });
}

for (const [label, response, code] of [
  ['truncated', envelope(valid, 'MAX_TOKENS'), 'INVALID_OUTPUT'],
  ['blocked', { promptFeedback: { blockReason: 'SAFETY' } }, 'AI_CONTENT_BLOCKED'],
  ['candidate safety', envelope(valid, 'SAFETY'), 'AI_CONTENT_BLOCKED'],
  ['null', null, 'INVALID_OUTPUT'], ['empty', {}, 'INVALID_OUTPUT'],
  ['bad JSON', { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } }] }, 'INVALID_OUTPUT'],
  ['null content part', { candidates: [{ finishReason: 'STOP', content: { parts: [null] } }] }, 'INVALID_OUTPUT'],
  ['scalar content part', { candidates: [{ finishReason: 'STOP', content: { parts: ['not a content part'] } }] }, 'INVALID_OUTPUT'],
  ['wrong schema', envelope({ ...valid, action: 'new_topic' }), 'INVALID_OUTPUT'],
]) {
  test(`provider rejects ${label}`, async () => {
    await assert.rejects(makeProvider(async () => Response.json(response)).next(base), { code });
  });
}

test('provider handles cancellation, invalid config and network failure safely', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(makeProvider(async () => { throw new Error('must not call'); }).next(base, { signal: controller.signal }), { code: 'REQUEST_CANCELLED' });
  for (const env of [{ GEMINI_MODEL: '../bad' }, { GEMINI_TIMEOUT_MS: 'NaN' }, { GEMINI_TIMEOUT_MS: '45001' }]) {
    await assert.rejects(makeProvider(async () => { throw new Error('must not call'); }, env).next(base), { code: 'AI_CONFIGURATION_ERROR' });
  }
  await assert.rejects(makeProvider(async () => { throw new Error('test-only-secret'); }).next(base), { code: 'AI_UNAVAILABLE' });
});

test('provider enforces its timeout', async () => {
  const provider = makeProvider((_url, { signal }) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('test watchdog')), 2500);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  }), { GEMINI_TIMEOUT_MS: '1000' });
  await assert.rejects(provider.next(base), { code: 'AI_TIMEOUT', status: 504 });
});
