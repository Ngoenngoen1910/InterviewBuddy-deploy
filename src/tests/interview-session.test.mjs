import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS_BY_DURATION,
  isUuid,
  todayInVietnam,
  toSessionResponse,
  toSessionRow,
  validateCreateSession,
} from '../lib/interview/session-contract.mjs';

const today = '2026-10-30';
const valid = {
  type: 'behavioral',
  difficulty: 'medium',
  language: 'vi',
  targetPosition: '  Frontend Intern  ',
  interviewDate: '2026-11-20',
  durationMinutes: 30,
  inputMode: 'text',
};

test('accepts the example request from the contract and trims the position', () => {
  const result = validateCreateSession(valid, { today });
  assert.equal(result.ok, true);
  assert.equal(result.value.targetPosition, 'Frontend Intern');
  assert.equal(result.value.fitAnalysisId, undefined, 'omitted = link the latest analysis');
});

test('interviewDate and fitAnalysisId are optional; null is allowed', () => {
  const noDate = { ...valid };
  delete noDate.interviewDate;
  assert.equal(validateCreateSession(noDate, { today }).value.interviewDate, null);
  assert.equal(validateCreateSession({ ...valid, interviewDate: null, fitAnalysisId: null }, { today }).value.fitAnalysisId, null);
});

test('every required field is reported when the body is empty', () => {
  const result = validateCreateSession({}, { today });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.fields).sort(),
    ['difficulty', 'durationMinutes', 'inputMode', 'language', 'targetPosition', 'type']);
});

test('rejects values outside the allowed lists', () => {
  const result = validateCreateSession(
    { ...valid, type: 'Technical', difficulty: 'expert', language: 'fr', durationMinutes: '30', inputMode: 'video' },
    { today },
  );
  assert.deepEqual(Object.keys(result.fields).sort(), ['difficulty', 'durationMinutes', 'inputMode', 'language', 'type']);
});

test('unknown field names are rejected so the form and API stay in sync', () => {
  const result = validateCreateSession({ ...valid, duration: 30, position: 'x' }, { today });
  assert.equal(result.fields.duration, 'Unknown field.');
  assert.equal(result.fields.position, 'Unknown field.');
});

test('interview date must be a real date, today or later (UC-05 alternative flow 4)', () => {
  assert.equal(validateCreateSession({ ...valid, interviewDate: today }, { today }).ok, true);
  assert.match(validateCreateSession({ ...valid, interviewDate: '2026-10-29' }, { today }).fields.interviewDate, /today or later/);
  assert.ok(validateCreateSession({ ...valid, interviewDate: '2026-02-30' }, { today }).fields.interviewDate);
  assert.ok(validateCreateSession({ ...valid, interviewDate: '20/11/2026' }, { today }).fields.interviewDate);
});

test('target position: required, not blank, at most 120 characters', () => {
  assert.ok(validateCreateSession({ ...valid, targetPosition: '   ' }, { today }).fields.targetPosition);
  assert.ok(validateCreateSession({ ...valid, targetPosition: 'x'.repeat(121) }, { today }).fields.targetPosition);
  assert.equal(validateCreateSession({ ...valid, targetPosition: 'x'.repeat(120) }, { today }).ok, true);
});

test('fitAnalysisId must be a UUID when given', () => {
  assert.ok(validateCreateSession({ ...valid, fitAnalysisId: '123' }, { today }).fields.fitAnalysisId);
  assert.equal(isUuid('3f1c2a9e-8b7d-4c6e-9a1b-2c3d4e5f6a7b'), true);
  assert.equal(isUuid("1' or '1'='1"), false);
});

test('non-object bodies are rejected', () => {
  for (const body of [null, 'text', 42, []]) {
    assert.equal(validateCreateSession(body, { today }).ok, false);
  }
});

test('database row: duration decides the number of questions and the JD/CV snapshot is copied', () => {
  const { value } = validateCreateSession({ ...valid, durationMinutes: 45 }, { today });
  const row = toSessionRow(value, { userId: 'u1', analysis: { id: 'a1', jd_text: 'JD', cv_text: 'CV' } });
  assert.equal(row.planned_questions, QUESTIONS_BY_DURATION[45]);
  assert.equal(row.round_type, 'behavioral');
  assert.equal(row.fit_analysis_id, 'a1');
  assert.equal(row.jd_text, 'JD');
  assert.equal(row.user_id, 'u1');
  const noAnalysis = toSessionRow(value, { userId: 'u1', analysis: null });
  assert.equal(noAnalysis.fit_analysis_id, null);
  assert.equal(noAnalysis.cv_text, null);
});

test('response maps snake_case columns to the camelCase contract', () => {
  const body = toSessionResponse({
    id: 's1', status: 'in_progress', created_at: 't', round_type: 'hr', difficulty: 'easy', language: 'en',
    target_position: 'PM', interview_date: null, duration_minutes: 15, input_mode: 'voice', planned_questions: 5,
    fit_analyses: { id: 'a1', fit_score: 78, language: 'en', created_at: 't2', result: { fitScore: 78 } },
  });
  assert.deepEqual(body.settings, {
    type: 'hr', difficulty: 'easy', language: 'en', targetPosition: 'PM', interviewDate: null,
    durationMinutes: 15, inputMode: 'voice', plannedQuestions: 5,
  });
  assert.equal(body.analysis.fitScore, 78);
  assert.equal(toSessionResponse({ id: 's2', fit_analyses: null }).analysis, null);
});

test('today is computed in Vietnam time, not server time', () => {
  // 18:00 UTC on 30/10 is already 01:00 on 31/10 in Vietnam.
  assert.equal(todayInVietnam(new Date('2026-10-30T18:00:00Z')), '2026-10-31');
});
