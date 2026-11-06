import { InterviewerError } from './interviewer-contract.mjs';

const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };
export function createNextHandler({ authenticate, makeService }) {
  return async function POST(request) {
    try {
      const auth = await authenticate(request);
      if (!auth) throw new InterviewerError('UNAUTHORIZED', 'Please sign in first.', 401);
      const mediaType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
      if (mediaType !== 'application/json') {
        throw new InterviewerError('BAD_INPUT', 'Use Content-Type: application/json.', 400);
      }
      // Bounded streaming read: forged Content-Length cannot bypass the limit.
      const reader = request.body?.getReader();
      if (!reader) throw new InterviewerError('BAD_INPUT', 'Request body is required.', 400);
      const chunks = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2048) { await reader.cancel(); throw new InterviewerError('BAD_INPUT', 'Request body is too large.', 400); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new InterviewerError('BAD_INPUT', 'Request body must be valid JSON.', 400); }
      const result = await makeService(auth)(body, { signal: request.signal });
      return Response.json(result, { headers });
    } catch (error) {
      const known = error instanceof InterviewerError;
      return Response.json({ error: {
        code: known ? error.code : 'SERVER_ERROR',
        message: known ? error.message : 'Could not generate the interview question. Please try again.',
      } }, { status: known ? error.status : 500, headers: {
        ...headers, ...(known && error.code === 'GENERATION_IN_PROGRESS' ? { 'Retry-After': '2' } : {}),
      } });
    }
  };
}
