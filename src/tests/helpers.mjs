import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createGeminiProvider } from '../lib/analysis/gemini.mjs';

export const fixtures = JSON.parse(await readFile(new URL('../../docs/test/fixtures/cv-jd-pairs.json', import.meta.url), 'utf8'));

export function geminiEnvelope(value, finishReason = 'STOP') {
  return { candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }] };
}

export function mockProviderFor(fixture, calls = []) {
  return createGeminiProvider({
    env: { GEMINI_API_KEY: 'offline-test-key', GEMINI_MODEL: 'gemini-test-fixture' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return Response.json(geminiEnvelope(fixture.aiResponse));
    },
  });
}

export function assertExpected(result, fixture) {
  assert.equal(result.fitScore, fixture.expected.fitScore);
  assert.deepEqual([...result.matchedSkills].sort(), [...fixture.expected.matchedSkills].sort());
  assert.deepEqual([...result.missingSkills].sort(), [...fixture.expected.missingSkills].sort());
  assert.equal(result.scoreBreakdown.matchedWeight, fixture.expected.matchedWeight);
  assert.equal(result.scoreBreakdown.totalWeight, fixture.expected.totalWeight);
  assert.equal(result.requirements.length, result.matchedSkills.length + result.missingSkills.length);
}
