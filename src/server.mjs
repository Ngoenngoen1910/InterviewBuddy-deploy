import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { createAnalysisHandler, originsFromEnvironment } from './lib/analysis/http.mjs';
import { createAnalysisFitHandler } from './lib/analysis/analysis-fit.mjs';

export function createApiServer({
  handler = createAnalysisHandler({ allowedOrigins: originsFromEnvironment() }),
  fitHandler = createAnalysisFitHandler({ allowedOrigins: originsFromEnvironment() }),
} = {}) {
  const server = createServer(async (incoming, outgoing) => {
    const controller = new AbortController();
    incoming.once('aborted', () => controller.abort());
    outgoing.once('close', () => { if (!outgoing.writableEnded) controller.abort(); });
    try {
      const path = new URL(incoming.url, 'http://localhost').pathname;
      if (path !== '/api/analyze' && path !== '/api/analyze-fit') {
        outgoing.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        outgoing.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Use POST /api/analyze or /api/analyze-fit.' } }));
        return;
      }
      const host = incoming.headers.host || 'localhost';
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((part) => headers.append(name, part));
        else if (value !== undefined) headers.set(name, value);
      }
      const hasBody = !['GET', 'HEAD'].includes(incoming.method);
      const request = new Request(`http://${host}${path}`, {
        method: incoming.method,
        headers,
        ...(hasBody ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}),
        signal: controller.signal,
      });
      const response = await (path === '/api/analyze-fit' ? fitHandler : handler)(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      if (!outgoing.headersSent) {
        outgoing.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        outgoing.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } }));
      } else outgoing.destroy();
    }
  });
  server.requestTimeout = 65000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  const host = process.env.HOST || '127.0.0.1';
  const server = createApiServer();
  server.on('error', (error) => { console.error(`API server failed: ${error.code || 'UNKNOWN'}`); process.exitCode = 1; });
  server.listen(port, host, () => {
    console.log(`InterviewBuddy analysis API: http://${host}:${port}/api/analyze`);
    console.log(`Khang UI contract: http://${host}:${port}/api/analyze-fit`);
    console.log(`Gemini configured: ${Boolean(process.env.GEMINI_API_KEY?.trim())}`);
  });
  for (const event of ['SIGINT', 'SIGTERM']) {
    process.once(event, () => server.close(() => process.exit(0)));
  }
}
