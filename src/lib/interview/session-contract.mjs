// Interview Session API contract (SCRUM-56): allowed values, request validation
// and the mapping between the API (camelCase) and the database (snake_case).
// Pure functions with no Next.js or Supabase imports, so `npm test` can run them.
// Full contract: docs/api/INTERVIEW_SESSION_API_v1.md

export const INTERVIEW_TYPES = ['hr', 'technical', 'behavioral'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const LANGUAGES = ['vi', 'en'];
export const DURATIONS = [15, 30, 45];
export const INPUT_MODES = ['text', 'voice'];

// The interview engine stops after this many main questions.
export const QUESTIONS_BY_DURATION = { 15: 5, 30: 8, 45: 12 };

export const TARGET_POSITION_MAX = 120;

const ALLOWED_FIELDS = [
  'type', 'difficulty', 'language', 'targetPosition',
  'interviewDate', 'durationMinutes', 'inputMode', 'fitAnalysisId',
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}

function isRealDate(value) {
  const m = typeof value === 'string' && ISO_DATE.exec(value);
  if (!m) return false;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.toISOString().slice(0, 10) === value;
}

// Today's date (YYYY-MM-DD) for Vietnamese users, whatever time zone the server runs in.
export function todayInVietnam(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

/**
 * Validates the body of POST /api/interview.
 * `today` is a YYYY-MM-DD string; interviewDate must not be earlier (UC-05, alternative flow 4).
 * fitAnalysisId: omitted = link the latest analysis, null = no analysis, uuid = that analysis.
 */
export function validateCreateSession(body, { today }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, fields: { body: 'Request body must be a JSON object.' } };
  }

  const fields = {};
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.includes(key)) fields[key] = 'Unknown field.';
  }

  const oneOf = (key, allowed) => {
    if (!allowed.includes(body[key])) fields[key] = `Must be one of: ${allowed.join(', ')}.`;
  };
  oneOf('type', INTERVIEW_TYPES);
  oneOf('difficulty', DIFFICULTIES);
  oneOf('language', LANGUAGES);
  oneOf('durationMinutes', DURATIONS);
  oneOf('inputMode', INPUT_MODES);

  const position = typeof body.targetPosition === 'string' ? body.targetPosition.trim() : '';
  if (!position) {
    fields.targetPosition = 'Required.';
  } else if (position.length > TARGET_POSITION_MAX) {
    fields.targetPosition = `At most ${TARGET_POSITION_MAX} characters.`;
  }

  const date = body.interviewDate ?? null;
  if (date !== null) {
    if (!isRealDate(date)) fields.interviewDate = 'Must be a date in YYYY-MM-DD format, or null.';
    else if (date < today) fields.interviewDate = 'Must be today or later.';
  }

  if (body.fitAnalysisId !== undefined && body.fitAnalysisId !== null && !isUuid(body.fitAnalysisId)) {
    fields.fitAnalysisId = 'Must be a UUID, null, or omitted.';
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };

  return {
    ok: true,
    value: {
      type: body.type,
      difficulty: body.difficulty,
      language: body.language,
      targetPosition: position,
      interviewDate: date,
      durationMinutes: body.durationMinutes,
      inputMode: body.inputMode,
      fitAnalysisId: body.fitAnalysisId,
    },
  };
}

/** Database row for public.interview_sessions from validated settings. */
export function toSessionRow(value, { userId, analysis }) {
  return {
    user_id: userId,
    round_type: value.type,
    difficulty: value.difficulty,
    language: value.language,
    target_position: value.targetPosition,
    interview_date: value.interviewDate,
    duration_minutes: value.durationMinutes,
    input_mode: value.inputMode,
    planned_questions: QUESTIONS_BY_DURATION[value.durationMinutes],
    title: `${value.targetPosition} – ${value.type}`,
    fit_analysis_id: analysis?.id ?? null,
    // Snapshot, so the session keeps working if the analysis is deleted later.
    jd_text: analysis?.jd_text ?? null,
    cv_text: analysis?.cv_text ?? null,
  };
}

/** Response body of GET /api/interview/{id}. */
export function toSessionResponse(row) {
  const analysis = row.fit_analyses ?? null;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    settings: {
      type: row.round_type,
      difficulty: row.difficulty,
      language: row.language,
      targetPosition: row.target_position,
      interviewDate: row.interview_date,
      durationMinutes: row.duration_minutes,
      inputMode: row.input_mode,
      plannedQuestions: row.planned_questions,
    },
    analysis: analysis && {
      id: analysis.id,
      fitScore: analysis.fit_score,
      language: analysis.language,
      createdAt: analysis.created_at,
      result: analysis.result,
    },
  };
}
