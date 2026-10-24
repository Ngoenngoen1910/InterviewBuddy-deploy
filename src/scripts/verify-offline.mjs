import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { createApiServer } from '../server.mjs';
import { createAnalysisHandler } from '../lib/analysis/http.mjs';
import { createAnalysisService } from '../lib/analysis/service.mjs';
import { createGeminiProvider } from '../lib/analysis/gemini.mjs';
import { createAnalysisClient } from '../lib/analysis/core-client.mjs';
import { fixtures, geminiEnvelope, assertExpected } from '../tests/helpers.mjs';

const calls = [];
const provider = createGeminiProvider({
  env: { GEMINI_API_KEY: 'offline-fixture-key', GEMINI_MODEL: 'gemini-offline-fixture' },
  fetchImpl: async (url, options) => {
    calls.push(url);
    const documents = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
    const fixture = fixtures.find((item) => item.input.cvText === documents.cvText && item.input.jdText === documents.jdText);
    assert.ok(fixture, 'Only the five synthetic fixtures are supported by the test transport.');
    return Response.json(geminiEnvelope(fixture.aiResponse));
  },
});
const server = createApiServer({ handler: createAnalysisHandler({ analyze: createAnalysisService({ provider }) }) });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const client = createAnalysisClient({ baseUrl: `http://127.0.0.1:${server.address().port}` });
const report = {
  task: 'SCRUM-43', mode: 'offline-http-with-mocked-gemini', generatedAt: new Date().toISOString(),
  externalGeminiCalls: 0,
  provenance: 'AI-authored synthetic CV/JD pairs and fixed fixture responses; no real Gemini output.',
  limitation: 'Verifies HTTP, Gemini request construction, response validation and scoring. Does not verify live AI extraction or semantic quality.',
  cases: [],
};
try {
  for (const fixture of fixtures) {
    try {
      const result = await client(fixture.input);
      assertExpected(result, fixture);
      report.cases.push({ id: fixture.id, title: fixture.title, status: 'passed', expected: fixture.expected, actual: {
        fitScore: result.fitScore, matchedSkills: result.matchedSkills, missingSkills: result.missingSkills,
        matchedWeight: result.scoreBreakdown.matchedWeight, totalWeight: result.scoreBreakdown.totalWeight,
      } });
      if (fixture.id === 'CVJD-02') {
        const examples = new URL('../../docs/api/examples/', import.meta.url);
        await mkdir(examples, { recursive: true });
        await writeFile(new URL('analyze.request.json', examples), `${JSON.stringify(fixture.input, null, 2)}\n`);
        await writeFile(new URL('analyze.success.json', examples), `${JSON.stringify(result, null, 2)}\n`);
      }
    } catch (error) {
      report.cases.push({ id: fixture.id, title: fixture.title, status: 'failed', error: error.code || error.name });
      process.exitCode = 1;
    }
  }
  report.mockedGeminiCalls = calls.length;
  report.passed = report.cases.filter((item) => item.status === 'passed').length;
  report.total = fixtures.length;
  const destination = new URL('../../docs/test/results/', import.meta.url);
  await mkdir(destination, { recursive: true });
  await writeFile(new URL('SCRUM-39-offline.json', destination), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Offline HTTP verification: ${report.passed}/${report.total} passed; external Gemini calls: 0.`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
