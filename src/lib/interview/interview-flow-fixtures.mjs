// AI-authored synthetic histories only; no real candidate or contact details.
import { interviewerFixtures } from './interviewer-fixtures.mjs';
const fixture = (id) => structuredClone(interviewerFixtures.find((entry) => entry.id === id).input);
const vague = fixture('backend-en-vague');
const interesting = fixture('backend-en-good');
interesting.history[0].answer += ' One unresolved issue is that the cached product page still shows the old stock value after commit; I have not investigated cache invalidation yet.';
const decline = fixture('frontend-vi-vague');
decline.history[0].answer = 'Em chưa biết cách làm và muốn chuyển sang câu hỏi khác.';
const capped = fixture('follow-up-cap');
capped.settings.language = 'en';
const long = fixture('backend-en-vague');
Object.assign(long.settings, { durationMinutes: 45, plannedQuestions: 12 });
long.jdText = 'React API requests and testing. API input validation. HTTP retries. PostgreSQL concurrent updates. API authorization.';
const older = [
  ['React requests', 'How would you handle stale API responses in React?', 'I would cancel the previous request in cleanup, ignore AbortError, update only the latest request, and test out-of-order responses.'],
  ['Input validation', 'How would you validate a JSON API request?', 'I would check required fields, types, lengths and accepted values before persistence, reject extra fields, and test invalid and boundary cases.'],
  ['HTTP retries', 'How would you retry an API request safely?', 'I would retry only safe transient failures with bounded backoff and an idempotency key for writes; validation errors must not be retried.'],
];
long.history = [...older.flatMap(([topic, question, answer]) => [
  { kind: 'main', topic, question, answer: answer.repeat(12) },
  { kind: 'follow_up', topic, question: `How would you verify the failure cases for ${topic}?`,
    answer: 'I would inject the described failure, assert the persisted and visible outcome, and confirm that recovery does not duplicate the operation.' },
]), ...long.history];
const questionLimit = fixture('question-limit');

export const interviewFlowFixtures = [
  { id: 'vague-technical-en', expectedActions: ['follow_up'], purpose: 'clarify the missing concurrency mechanism', input: vague },
  { id: 'interesting-detail-en', expectedActions: ['follow_up'], purpose: 'probe the explicitly unresolved stale-cache issue', input: interesting },
  { id: 'developed-behavioral-vi', expectedActions: ['next_topic'], purpose: 'move on from a developed STAR account without invented achievements', input: fixture('behavioral-vi-good') },
  { id: 'declines-answer-vi', expectedActions: ['next_topic'], purpose: 'respect an explicit request to move on', input: decline },
  { id: 'follow-up-cap-en', expectedActions: ['next_topic'], purpose: 'enforce the configured cap even after a vague answer', input: capped },
  { id: 'long-memory-en', expectedActions: ['follow_up'], purpose: 'use four recent turns plus an earlier summary, preserving full counters', input: long },
  { id: 'time-limit', expectedActions: ['end'], purpose: 'end locally without a Gemini request', input: fixture('time-limit') },
  { id: 'question-limit', expectedActions: ['end'], purpose: 'count all saved main questions, not only the recent four', input: questionLimit },
  { id: 'closed-session', expectedActions: ['end'], purpose: 'closed state takes precedence over generation',
    input: { ...fixture('backend-en-vague'), state: { status: 'abandoned', elapsedSeconds: 90 } } },
];
