import { AnalysisError } from './errors.mjs';
import { LIMITS, validateInput } from './contracts.mjs';
import { createAnalysisService } from './service.mjs';

async function readJson(request) {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && Number(declaredLength) > LIMITS.maxBodyBytes) {
    await request.body?.cancel();
    throw new AnalysisError('PAYLOAD_TOO_LARGE', 'Request body exceeds 400000 bytes.', 413);
  }
  if (!request.body) throw new AnalysisError('INVALID_JSON', 'A JSON request body is required.', 400);
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > LIMITS.maxBodyBytes) {
        await reader.cancel();
        throw new AnalysisError('PAYLOAD_TOO_LARGE', 'Request body exceeds 400000 bytes.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new AnalysisError('INVALID_JSON', 'Request body must contain valid UTF-8 JSON.', 400);
  }
}

export function createAnalysisHandler({
  analyze = createAnalysisService(),
  allowedOrigins = [],
  normalizeInput = validateInput,
  formatResult = (result) => result,
  formatError = (error) => error,
  endpoint = '/api/analyze',
} = {}) {
  const allowed = new Set(allowedOrigins);
  return async function handleAnalysis(request) {
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin',
    });
    const respond = (status, value) => new Response(value === null ? null : JSON.stringify(value), { status, headers });
    try {
      const origin = request.headers.get('origin');
      const sameOrigin = origin === new URL(request.url).origin;
      if (origin && !sameOrigin && !allowed.has(origin)) {
        throw new AnalysisError('ORIGIN_NOT_ALLOWED', 'This origin is not allowed to call the API.', 403);
      }
      if (origin) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
      }
      if (request.method === 'OPTIONS') return respond(204, null);
      if (request.method !== 'POST') {
        headers.set('Allow', 'POST, OPTIONS');
        throw new AnalysisError('METHOD_NOT_ALLOWED', `Use POST ${endpoint}.`, 405);
      }
      if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        throw new AnalysisError('UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.', 415);
      }
      const body = normalizeInput(await readJson(request));
      const result = await analyze(body, { signal: request.signal });
      return respond(200, formatResult(result, body));
    } catch (error) {
      const known = error instanceof AnalysisError;
      const status = known ? error.status : 500;
      return respond(status, { error: formatError({
        code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'An unexpected error occurred.',
        ...(known && error.details ? { details: error.details } : {}),
      }, status) });
    }
  };
}

export function originsFromEnvironment(env = process.env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
}
