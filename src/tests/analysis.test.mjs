import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, LIMITS, GEMINI_ANALYSIS_SCHEMA } from '../lib/analysis/contracts.mjs';
import { scoreAnalysis } from '../lib/analysis/scoring.mjs';
import { createAnalysisService } from '../lib/analysis/service.mjs';
import { fixtures, mockProviderFor, assertExpected } from './helpers.mjs';

for (const fixture of fixtures) {
  test(`${fixture.id}: ${fixture.title} - full service with mocked Gemini transport`, async () => {
    const calls = [];
    const analyze = createAnalysisService({ provider: mockProviderFor(fixture, calls) });
    const result = await analyze(fixture.input);
    assertExpected(result, fixture);
    assert.equal(calls.length, 1);
    assert.equal(result.meta.provider, 'gemini');
    assert.equal(result.meta.scoringVersion, 'weighted-skills-v1');
    assert.equal(result.meta.language, fixture.input.language);
    assert.match(result.analysisId, /^[0-9a-f-]{36}$/u);
  });
}

test('validation trims input and defaults the response language to Vietnamese', () => {
  const input = validateInput({ cvText: `  ${fixtures[0].input.cvText}  `, jdText: fixtures[0].input.jdText });
  assert.equal(input.cvText, fixtures[0].input.cvText);
  assert.equal(input.language, 'vi');
});

for (const [label, value] of [
  ['null', null], ['array', []], ['empty', {}], ['non-string CV', { ...fixtures[0].input, cvText: 100 }],
  ['blank JD', { ...fixtures[0].input, jdText: '  ' }],
  ['short CV', { ...fixtures[0].input, cvText: 'React' }],
  ['long CV', { ...fixtures[0].input, cvText: 'x'.repeat(LIMITS.maxCvCharacters + 1) }],
  ['long JD', { ...fixtures[0].input, jdText: 'x'.repeat(LIMITS.maxJdCharacters + 1) }],
  ['invalid language', { ...fixtures[0].input, language: 'fr' }],
  ['client API key', { ...fixtures[0].input, apiKey: 'must-not-be-accepted' }],
]) {
  test(`rejects ${label} before invoking the provider`, async () => {
    let calls = 0;
    const analyze = createAnalysisService({ provider: { model: 'test', analyze: async () => { calls++; } } });
    await assert.rejects(analyze(value), { code: 'VALIDATION_ERROR', status: 400 });
    assert.equal(calls, 0);
  });
}

test('aliases are deduplicated and cannot inflate the weighted score', () => {
  const input = {
    cvText: 'Developed a website with JavaScript and used Git for version control.',
    jdText: 'Required: JavaScript, SQL. Preferred: JS and Git.',
  };
  const raw = {
    summary: 'One required skill is missing.',
    requirements: [
      { skill: 'JavaScript', importance: 'required', matched: true, jdEvidence: 'Required: JavaScript, SQL.', cvEvidence: 'Developed a website with JavaScript', reason: 'Project evidence.' },
      { skill: 'JS', importance: 'preferred', matched: true, jdEvidence: 'Preferred: JS and Git.', cvEvidence: 'Developed a website with JavaScript', reason: 'Same language alias.' },
      { skill: 'SQL', importance: 'required', matched: false, jdEvidence: 'Required: JavaScript, SQL.', cvEvidence: '', reason: 'No SQL evidence.' },
      { skill: 'Git', importance: 'preferred', matched: true, jdEvidence: 'Preferred: JS and Git.', cvEvidence: 'used Git for version control.', reason: 'Git evidence.' },
    ],
  };
  const result = scoreAnalysis(raw, input);
  assert.equal(result.fitScore, 60);
  assert.equal(result.requirements.length, 3);
  assert.equal(result.scoreBreakdown.totalWeight, 5);
});

test('C, C++, and C# remain distinct skills', () => {
  const input = { cvText: 'Used C++ for a systems programming project.', jdText: 'Required programming languages: C, C++, and C#.' };
  const result = scoreAnalysis({ summary: 'C++ has evidence.', requirements: ['C', 'C++', 'C#'].map((skill) => ({
    skill, importance: 'required', matched: skill === 'C++', jdEvidence: input.jdText,
    cvEvidence: skill === 'C++' ? input.cvText : '', reason: 'Check the exact programming language.',
  })) }, input);
  assert.equal(result.fitScore, 33.33);
  assert.deepEqual(result.matchedSkills, ['C++']);
});

test('rejects a fabricated CV quotation', () => {
  const raw = structuredClone(fixtures[0].aiResponse);
  raw.requirements[0].cvEvidence = 'I am an expert in all skills.';
  assert.throws(() => scoreAnalysis(raw, fixtures[0].input), { code: 'INVALID_AI_RESPONSE' });
});

test('rejects a fabricated JD requirement quotation', () => {
  const raw = structuredClone(fixtures[0].aiResponse);
  raw.requirements[0].jdEvidence = 'Required skill: Kubernetes.';
  assert.throws(() => scoreAnalysis(raw, fixtures[0].input), { code: 'INVALID_AI_RESPONSE' });
});

test('rejects a match without CV evidence', () => {
  const raw = structuredClone(fixtures[0].aiResponse);
  raw.requirements[0].cvEvidence = '';
  assert.throws(() => scoreAnalysis(raw, fixtures[0].input), { code: 'INVALID_AI_RESPONSE' });
});

test('empty requirements produce a useful 422, not a misleading zero score', () => {
  assert.throws(() => scoreAnalysis({ requirements: [], summary: 'No skills specified.' }, fixtures[0].input), {
    code: 'NO_JOB_REQUIREMENTS', status: 422,
  });
});

test('rejects an AI-supplied score and malformed field types', () => {
  assert.throws(() => scoreAnalysis({ ...fixtures[0].aiResponse, fitScore: 100 }, fixtures[0].input), { code: 'INVALID_AI_RESPONSE' });
  const raw = structuredClone(fixtures[0].aiResponse);
  raw.requirements[0].matched = 'true';
  assert.throws(() => scoreAnalysis(raw, fixtures[0].input), { code: 'INVALID_AI_RESPONSE' });
});

test('Gemini schema avoids a maxItems constraint that fails real requests', () => {
  assert.equal(Object.hasOwn(GEMINI_ANALYSIS_SCHEMA.properties.requirements, 'maxItems'), false);
});

test('backend still rejects more than forty requirements', () => {
  const raw = structuredClone(fixtures[0].aiResponse);
  raw.requirements = Array.from({ length: 41 }, () => structuredClone(raw.requirements[0]));
  assert.throws(() => scoreAnalysis(raw, fixtures[0].input), { code: 'INVALID_AI_RESPONSE' });
});
