import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAnalysisService } from '../lib/analysis/service.mjs';
import { createAnalysisFitHandler } from '../lib/analysis/analysis-fit.mjs';
import { AnalysisError } from '../lib/analysis/errors.mjs';
import { createApiServer } from '../server.mjs';
import { POST as nextPost, GET as nextGet } from '../app/api/analyze-fit/route.js';
import { fixtures, mockProviderFor } from './helpers.mjs';

function fitRequest(input, options = {}) {
  return new Request('http://localhost:3001/api/analyze-fit', {
    method: options.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...(options.method === 'GET' ? {} : { body: JSON.stringify(input) }),
  });
}

function khangInput(fixture) {
  return { cv: fixture.input.cvText, jd: fixture.input.jdText, language: fixture.input.language };
}

for (const fixture of fixtures) {
  test(`${fixture.id}: Khang contract preserves the verified score and skill evidence`, async () => {
    const handler = createAnalysisFitHandler({
      analyze: createAnalysisService({ provider: mockProviderFor(fixture) }),
    });
    const response = await handler(fitRequest(khangInput(fixture)));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = await response.json();
    assert.equal(body.fitScore, fixture.expected.fitScore);
    assert.deepEqual(body.matched.map((item) => item.skill).sort(), [...fixture.expected.matchedSkills].sort());
    assert.deepEqual(body.missing.map((item) => item.skill).sort(), [...fixture.expected.missingSkills].sort());
    assert.equal(body.requirements.length, body.matched.length + body.missing.length);
    assert.ok(body.matched.every((item) => item.evidence.length > 0));
    assert.ok(body.missing.every((item) => item.note.length > 0));
    assert.ok(body.requirements.every((item) => ['matched', 'missing'].includes(item.status)));
    assert.ok(body.requirements.every((item) => typeof item.evidence === 'string'));
    assert.ok(body.recommendation.length > 0);
    assert.deepEqual(Object.keys(body).sort(), ['fitScore', 'matched', 'missing', 'recommendation', 'requirements'].sort());
  });
}

for (const input of [
  {},
  { cv: 'x'.repeat(29), jd: fixtures[0].input.jdText },
  { cv: fixtures[0].input.cvText, jd: 'x'.repeat(3001) },
  { ...khangInput(fixtures[0]), language: 'fr' },
  { ...khangInput(fixtures[0]), apiKey: 'must-not-be-accepted' },
]) {
  test('Khang contract rejects invalid input before calling Gemini', async () => {
    let calls = 0;
    const handler = createAnalysisFitHandler({ analyze: async () => { calls++; } });
    const response = await handler(fitRequest(input));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'BAD_INPUT');
    assert.equal(calls, 0);
  });
}

test('Khang route has the expected Next.js method and input validation', async () => {
  const response = await nextPost(fitRequest({}));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'BAD_INPUT');
  const getResponse = await nextGet(fitRequest(undefined, { method: 'GET' }));
  assert.equal(getResponse.status, 405);
  assert.equal(getResponse.headers.get('Allow'), 'POST, OPTIONS');
});

test('Khang contract maps Gemini rate limit into the code used by his client', async () => {
  const handler = createAnalysisFitHandler({ analyze: async () => {
    throw new AnalysisError('AI_RATE_LIMITED', 'Upstream quota message.', 429);
  } });
  const response = await handler(fitRequest(khangInput(fixtures[0])));
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.equal(body.error.code, 'RATE_LIMIT');
  assert.doesNotMatch(body.error.message, /Upstream/u);
});

test('Khang endpoint works through the standalone HTTP server', async () => {
  const fitHandler = createAnalysisFitHandler({
    analyze: createAnalysisService({ provider: mockProviderFor(fixtures[1]) }),
  });
  const server = createApiServer({ fitHandler });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/analyze-fit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(khangInput(fixtures[1])),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).fitScore, 60);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
