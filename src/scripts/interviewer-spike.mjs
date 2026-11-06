import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { interviewerFixtures } from '../lib/interview/interviewer-fixtures.mjs';
import { CONTRACT_VERSION, createEndDecision, getInterviewPolicy, InterviewerError, validateInterviewerInput } from '../lib/interview/interviewer-contract.mjs';
import { buildInterviewerRequest, PROMPT_VERSION } from '../lib/interview/interviewer-prompt.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';

// Sends ONLY the synthetic fixtures shipped in this module; no arbitrary CV file option.
const args = process.argv.slice(2);
const live = args.includes('--live');
const caseIndex = args.indexOf('--case');
const selected = caseIndex >= 0 ? args[caseIndex + 1] : null;
const expectedArgs = new Set(['--live', '--case', ...(selected ? [selected] : [])]);
if (args.some((arg) => !expectedArgs.has(arg)) || (caseIndex >= 0 && !selected)
  || (selected && !interviewerFixtures.some((fixture) => fixture.id === selected))) {
  console.error('Usage: node scripts/interviewer-spike.mjs [--live] [--case <fixture-id>]');
  process.exit(2);
}
const cases = selected ? interviewerFixtures.filter((fixture) => fixture.id === selected) : interviewerFixtures;
let externalCalls = 0;
const provider = createInterviewerProvider({ fetchImpl: (...options) => { externalCalls++; return fetch(...options); } });
const report = {
  task: 'SCRUM-67', promptVersion: PROMPT_VERSION, contractVersion: CONTRACT_VERSION,
  generatedAt: new Date().toISOString(), mode: live ? 'live' : 'prepared-offline', model: provider.model,
  provenance: 'AI-authored synthetic CV/JD and answers only. No real personal data. No database writes.',
  humanReview: 'pending', quota: 'Project RPM/TPM/RPD and billing tier have not been inspected in AI Studio.',
  cases: [],
};
let stopCode;
for (const fixture of cases) {
  const input = validateInterviewerInput(fixture.input);
  const entry = { id: fixture.id, quality: fixture.quality, expectedActions: fixture.expectedActions, policy: getInterviewPolicy(input) };
  if (!live) {
    report.cases.push({ ...entry, status: 'prepared', input, request: buildInterviewerRequest(input), localEndDecision: createEndDecision(input) });
    continue;
  }
  if (stopCode) {
    report.cases.push({ ...entry, status: 'skipped', error: stopCode });
    continue;
  }
  const before = performance.now();
  const callsBefore = externalCalls;
  try {
    const result = await provider.next(input);
    const actionMatchesExpectation = fixture.expectedActions.includes(result.action);
    report.cases.push({ ...entry, status: 'valid-output', actionMatchesExpectation,
      needsHumanReview: true, latencyMs: Math.round(performance.now() - before),
      source: callsBefore === externalCalls ? 'server-policy' : 'gemini', result,
    });
    console.log(`${fixture.id}: valid-output, action=${result.action}, expected-action=${actionMatchesExpectation}`);
  } catch (error) {
    const code = error instanceof InterviewerError ? error.code : 'UNEXPECTED_ERROR';
    report.cases.push({ ...entry, status: 'failed', error: code, latencyMs: Math.round(performance.now() - before) });
    console.log(`${fixture.id}: ${code}`);
    if (['AI_NOT_CONFIGURED', 'AI_CONFIGURATION_ERROR', 'AI_RATE_LIMITED', 'AI_UNAVAILABLE'].includes(code)) stopCode = code;
  }
}
report.externalCalls = externalCalls;
report.total = report.cases.length;
report.validOutputs = report.cases.filter((entry) => entry.status === 'valid-output').length;
report.actionMatches = report.cases.filter((entry) => entry.actionMatchesExpectation).length;
report.status = !live ? 'prepared-only' : report.validOutputs === report.total ? 'completed-needs-human-review' : 'incomplete';
const destination = new URL('../../docs/test/results/', import.meta.url);
await mkdir(destination, { recursive: true });
const name = `ai-interviewer-spike-${live ? (selected || 'live') : 'prepared'}-v${PROMPT_VERSION}.json`;
await writeFile(new URL(name, destination), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Report: docs/test/results/${name}; external calls=${externalCalls}; status=${report.status}`);
if (live && (report.validOutputs !== report.total || report.actionMatches !== report.total)) process.exitCode = 1;
