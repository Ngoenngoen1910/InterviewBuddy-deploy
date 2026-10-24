import { mkdir, writeFile } from 'node:fs/promises';
import { createAnalysisService } from '../lib/analysis/service.mjs';
import { fixtures } from '../tests/helpers.mjs';

const report = {
  task: 'SCRUM-43', mode: 'live-gemini', generatedAt: new Date().toISOString(),
  provenance: 'Only the five AI-authored synthetic CV/JD fixtures are sent to Gemini. No real personal data.',
  status: 'not-run', cases: [],
};
const aliases = new Map([['react.js', 'react'], ['reactjs', 'react'], ['nodejs', 'node.js'], ['postgres', 'postgresql'], ['powerbi', 'power bi']]);
function normalizeSkills(skills) {
  return skills.map((skill) => {
    const normalized = skill.normalize('NFKC').trim().toLocaleLowerCase('en-US');
    return aliases.get(normalized) || normalized;
  }).sort();
}
if (!process.env.GEMINI_API_KEY?.trim()) {
  report.status = 'blocked';
  report.reason = 'GEMINI_API_KEY is not configured. No live requests were sent.';
  report.externalGeminiCalls = 0;
  process.exitCode = 2;
  console.log(report.reason);
} else {
  const analyze = createAnalysisService();
  for (const fixture of fixtures) {
    try {
      const result = await analyze(fixture.input);
      const matchesExpected = result.fitScore === fixture.expected.fitScore
        && JSON.stringify(normalizeSkills(result.matchedSkills)) === JSON.stringify(normalizeSkills(fixture.expected.matchedSkills))
        && JSON.stringify(normalizeSkills(result.missingSkills)) === JSON.stringify(normalizeSkills(fixture.expected.missingSkills));
      report.cases.push({ id: fixture.id, title: fixture.title, status: matchesExpected ? 'passed' : 'needs-review', expected: fixture.expected, result });
      console.log(`${fixture.id}: ${matchesExpected ? 'passed' : 'needs-review'}, fitScore=${result.fitScore}`);
    } catch (error) {
      report.cases.push({ id: fixture.id, title: fixture.title, status: 'failed', error: error.code || 'UNEXPECTED_ERROR' });
      console.log(`${fixture.id}: ${error.code || 'UNEXPECTED_ERROR'}`);
    }
  }
  report.passed = report.cases.filter((item) => item.status === 'passed').length;
  report.total = fixtures.length;
  report.status = report.passed === fixtures.length ? 'passed' : 'needs-review';
  if (report.status !== 'passed') process.exitCode = 1;
}
const destination = new URL('../../docs/test/results/', import.meta.url);
await mkdir(destination, { recursive: true });
await writeFile(new URL('SCRUM-39-live.json', destination), `${JSON.stringify(report, null, 2)}\n`);
