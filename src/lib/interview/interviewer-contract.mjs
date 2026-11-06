import { DIFFICULTIES, DURATIONS, INTERVIEW_TYPES, LANGUAGES, QUESTIONS_BY_DURATION } from './session-contract.mjs';

export const CONTRACT_VERSION = '0.1';
export const FOLLOW_UP_LIMITS = Object.freeze({ easy: 1, medium: 2, hard: 3 });
export const INTERVIEW_LIMITS = Object.freeze({ jd: 30000, cv: 50000, answer: 12000, history: 48, total: 180000 });

export class InterviewerError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = 'InterviewerError';
    this.code = code;
    this.status = status;
  }
}

function badInput() {
  throw new InterviewerError('BAD_INPUT', 'Invalid interview context. Check the documented input contract.', 400);
}

function objectWith(value, required, optional = []) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}

function text(value, min, max) {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

export function normalizeQuestion(value) {
  return value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\p{P}\p{Z}\s]+/gu, ' ').trim();
}

/** Internal server input, NOT the body of a browser-facing endpoint. History contains completed turns only. */
export function validateInterviewerInput(value) {
  if (!objectWith(value, ['settings', 'state', 'history'], ['jdText', 'cvText'])) badInput();
  const { settings, state, history } = value;
  if (!objectWith(settings, ['type', 'difficulty', 'language', 'targetPosition', 'durationMinutes', 'plannedQuestions'])
    || !INTERVIEW_TYPES.includes(settings.type) || !DIFFICULTIES.includes(settings.difficulty)
    || !LANGUAGES.includes(settings.language) || !DURATIONS.includes(settings.durationMinutes)
    || !text(settings.targetPosition, 1, 120)
    || settings.plannedQuestions !== QUESTIONS_BY_DURATION[settings.durationMinutes]) badInput();
  if (!objectWith(state, ['status', 'elapsedSeconds'])
    || !['in_progress', 'completed', 'abandoned'].includes(state.status)
    || !Number.isFinite(state.elapsedSeconds) || state.elapsedSeconds < 0) badInput();
  if (!Array.isArray(history) || history.length > INTERVIEW_LIMITS.history) badInput();
  let followUps = 0;
  let mainCount = 0;
  let topic;
  for (const turn of history) {
    if (!objectWith(turn, ['question', 'answer', 'topic', 'kind'])
      || !text(turn.question, 1, 1200) || !text(turn.answer, 1, INTERVIEW_LIMITS.answer)
      || !text(turn.topic, 1, 160) || !['main', 'follow_up'].includes(turn.kind)) badInput();
    if (turn.kind === 'main') {
      mainCount++;
      followUps = 0;
      topic = turn.topic.trim();
    } else {
      followUps++;
      if (!mainCount || turn.topic.trim() !== topic || followUps > FOLLOW_UP_LIMITS[settings.difficulty]) badInput();
    }
  }
  if (mainCount > settings.plannedQuestions) badInput();
  for (const [key, max] of [['jdText', INTERVIEW_LIMITS.jd], ['cvText', INTERVIEW_LIMITS.cv]]) {
    if (value[key] != null && !text(value[key], 0, max)) badInput();
  }
  // Reject oversized contexts rather than silently losing previous questions or the end of a CV.
  if (JSON.stringify(value).length > INTERVIEW_LIMITS.total) badInput();
  return {
    settings: { ...settings, targetPosition: settings.targetPosition.trim() },
    state: { ...state },
    jdText: value.jdText?.trim() || '', cvText: value.cvText?.trim() || '',
    history: history.map((turn) => Object.fromEntries(Object.entries(turn).map(([k, v]) => [k, v.trim()]))),
  };
}

/** Derive limits from persisted completed turns; the LLM never supplies these counters. */
export function getInterviewPolicy(input) {
  const mainQuestionsAnswered = input.history.filter((turn) => turn.kind === 'main').length;
  let followUpsForCurrent = 0;
  for (let i = input.history.length - 1; i >= 0 && input.history[i].kind === 'follow_up'; i--) followUpsForCurrent++;
  const endReason = input.state.status !== 'in_progress' ? 'session_closed'
    : input.state.elapsedSeconds >= input.settings.durationMinutes * 60 ? 'time_limit'
      : mainQuestionsAnswered >= input.settings.plannedQuestions ? 'question_limit' : null;
  const maxFollowUps = FOLLOW_UP_LIMITS[input.settings.difficulty];
  const allowedActions = endReason ? ['end']
    : !input.history.length || followUpsForCurrent >= maxFollowUps ? ['next_topic'] : ['follow_up', 'next_topic'];
  return { allowedActions, endReason, mainQuestionsAnswered, followUpsForCurrent, maxFollowUps };
}

export const INTERVIEWER_OUTPUT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    action: { type: 'string', enum: ['follow_up', 'next_topic', 'end'] },
    question: { type: ['string', 'null'], description: 'One focused question, or null only for end.' },
    topic: { type: 'string', description: 'Concise topic. For follow_up copy the current topic exactly.' },
    reason: { type: 'string', description: 'One short decision rationale for developers, not hidden chain of thought or a candidate score.' },
  },
  required: ['action', 'question', 'topic', 'reason'],
};

export function validateInterviewerOutput(value, input) {
  const invalid = () => { throw new InterviewerError('INVALID_OUTPUT', 'The interviewer returned an invalid decision.'); };
  if (!objectWith(value, ['action', 'question', 'topic', 'reason'])
    || !getInterviewPolicy(input).allowedActions.includes(value.action)
    || !text(value.topic, 1, 160) || !text(value.reason, 1, 700)) invalid();
  if (value.action === 'end') {
    if (value.question !== null) invalid();
  } else {
    if (!text(value.question, 1, 1200)) invalid();
    if (input.history.some((turn) => normalizeQuestion(turn.question) === normalizeQuestion(value.question))) invalid();
    if (value.action === 'follow_up' && value.topic.trim() !== input.history.at(-1)?.topic) invalid();
  }
  return { action: value.action, question: value.question?.trim() ?? null, topic: value.topic.trim(), reason: value.reason.trim() };
}

export function createEndDecision(input) {
  const { endReason } = getInterviewPolicy(input);
  if (!endReason) return null;
  const vi = input.settings.language === 'vi';
  const reasons = {
    session_closed: vi ? 'Phiên phỏng vấn đã được đóng.' : 'The interview session is already closed.',
    time_limit: vi ? 'Đã đạt thời lượng phỏng vấn đã cấu hình.' : 'The configured interview time limit has been reached.',
    question_limit: vi ? 'Đã hoàn thành số câu hỏi chính đã cấu hình.' : 'The configured main-question budget has been completed.',
  };
  return { action: 'end', question: null, topic: input.history.at(-1)?.topic || (vi ? 'Kết thúc' : 'Closing'), reason: reasons[endReason] };
}
