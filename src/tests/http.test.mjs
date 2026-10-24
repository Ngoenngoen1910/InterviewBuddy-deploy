import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAnalysisHandler } from '../lib/analysis/http.mjs';
import { createAnalysisService } from '../lib/analysis/service.mjs';
import { createGeminiProvider } from '../lib/analysis/gemini.mjs';
import { createAnalysisClient, AnalysisApiError } from '../lib/analysis/core-client.mjs';
import { createApiServer } from '../server.mjs';
import { POST as nextPost, GET as nextGet } from '../app/api/analyze/route.js';
import { fixtures, mockProviderFor, assertExpected } from './helpers.mjs';

function request(body = fixtures[0].input, { method = 'POST', headers = {} } = {}) {
  return new Request('http://localhost:3001/api/analyze', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
}

test('JSON response returns the documented score and no cache', async () => {
  const handler = createAnalysisHandler({ analyze: createAnalysisService({ provider: mockProviderFor(fixtures[0]) }) });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assertExpected(await response.json(), fixtures[0]);
});

for (const [label, req, status, code] of [
  ['GET', request(undefined, { method: 'GET' }), 405, 'METHOD_NOT_ALLOWED'],
  ['malformed JSON', request('{ broken'), 400, 'INVALID_JSON'],
  ['wrong media type', request('{}', { headers: { 'Content-Type': 'text/plain' } }), 415, 'UNSUPPORTED_MEDIA_TYPE'],
  ['invalid fields', request({}), 400, 'VALIDATION_ERROR'],
  ['oversized content length', request('{}', { headers: { 'Content-Length': '400001' } }), 413, 'PAYLOAD_TOO_LARGE'],
  ['oversized stream without length', request('x'.repeat(400001)), 413, 'PAYLOAD_TOO_LARGE'],
  ['disallowed origin', request(undefined, { headers: { Origin: 'https://not-allowed.example' } }), 403, 'ORIGIN_NOT_ALLOWED'],
]) {
  test(`HTTP rejects ${label} without calling AI`, async () => {
    let calls = 0;
    const handler = createAnalysisHandler({ analyze: async () => { calls++; } });
    const response = await handler(req);
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
    assert.equal(calls, 0);
  });
}

test('CORS preflight allows only configured frontend origins', async () => {
  const handler = createAnalysisHandler({ allowedOrigins: ['http://localhost:3000'] });
  const response = await handler(request(undefined, { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000' } }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:3000');
  assert.equal(await response.text(), '');
});

test('same-origin Next.js requests do not need a CORS allowlist', async () => {
  const handler = createAnalysisHandler({ analyze: createAnalysisService({ provider: mockProviderFor(fixtures[0]) }) });
  const response = await handler(request(undefined, { headers: { Origin: 'http://localhost:3001' } }));
  assert.equal(response.status, 200);
});

test('missing server key returns 503 and never silently uses fixture data', async () => {
  const handler = createAnalysisHandler({ analyze: createAnalysisService({ provider: createGeminiProvider({ env: {} }) }) });
  const response = await handler(request());
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, 'AI_NOT_CONFIGURED');
  assert.equal(body.fitScore, undefined);
});

test('internal errors do not leak implementation details', async () => {
  const handler = createAnalysisHandler({ analyze: async () => { throw new Error('raw CV and secret-key'); } });
  const response = await handler(request());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
});

test('Next.js route adapter and standalone handler expose the same validation contract', async () => {
  const response = await nextPost(request({}));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
});

test('Next.js GET adapter returns the documented JSON 405 error', async () => {
  const response = await nextGet(request(undefined, { method: 'GET' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST, OPTIONS');
  assert.equal((await response.json()).error.code, 'METHOD_NOT_ALLOWED');
});

test('Khang client sends the correct request and propagates structured errors', async () => {
  let sent;
  const client = createAnalysisClient({ baseUrl: 'http://localhost:3001/', fetchImpl: async (url, options) => {
    sent = { url, options };
    return Response.json({ error: { code: 'AI_NOT_CONFIGURED', message: 'Not configured.' } }, { status: 503 });
  } });
  await assert.rejects(client(fixtures[0].input), (error) => {
    assert.ok(error instanceof AnalysisApiError);
    assert.equal(error.code, 'AI_NOT_CONFIGURED');
    return true;
  });
  assert.equal(sent.url, 'http://localhost:3001/api/analyze');
  assert.deepEqual(JSON.parse(sent.options.body), fixtures[0].input);
  assert.equal(sent.options.cache, 'no-store');
});

test('client rejects invalid server output', async () => {
  const client = createAnalysisClient({ fetchImpl: async () => Response.json({ fitScore: 900 }) });
  await assert.rejects(client(fixtures[0].input), { code: 'INVALID_RESPONSE' });
});

test('standalone server and browser client work over actual local HTTP', async () => {
  const handler = createAnalysisHandler({ analyze: createAnalysisService({ provider: mockProviderFor(fixtures[1]) }) });
  const server = createApiServer({ handler });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const client = createAnalysisClient({ baseUrl });
    assertExpected(await client(fixtures[1].input), fixtures[1]);
    const missing = await fetch(`${baseUrl}/missing`);
    assert.equal(missing.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
