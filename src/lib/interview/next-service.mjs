import { isUuid } from './session-contract.mjs';
import { InterviewerError, validateInterviewerInput, validateInterviewerOutput } from './interviewer-contract.mjs';
import { PROMPT_VERSION } from './interviewer-prompt.mjs';
import { QUESTION_PLAN_VERSION } from './question-plan.mjs';
import { CONVERSATION_MEMORY_VERSION } from './conversation-memory.mjs';

export function validateNextRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((key) => !['sessionId', 'afterAnswerId'].includes(key))
      || !isUuid(body.sessionId) || !Object.hasOwn(body, 'afterAnswerId')
      || (body.afterAnswerId !== null && !isUuid(body.afterAnswerId))) {
    throw new InterviewerError('BAD_INPUT', 'Provide sessionId and afterAnswerId (null for the opening question).', 400);
  }
  return { sessionId: body.sessionId, afterAnswerId: body.afterAnswerId };
}

export function contextFromSnapshot(snapshot, now = Date.now()) {
  const { session, questions } = snapshot;
  const start = Date.parse(session.started_at);
  if (!Number.isFinite(start) || !Array.isArray(questions)) {
    throw new InterviewerError('SESSION_CONTEXT_INVALID', 'The saved session needs to be repaired before continuing.', 409);
  }
  const history = questions.map((q, index) => {
    if (q.position !== index + 1 || !q.answer) {
      throw new InterviewerError('SESSION_CONTEXT_INVALID', 'The saved question history is incomplete.', 409);
    }
    return { kind: q.kind, topic: q.topic, question: q.content, answer: q.answer.content };
  });
  try {
    return validateInterviewerInput({
      settings: {
        type: session.round_type, difficulty: session.difficulty, language: session.language,
        targetPosition: session.target_position, durationMinutes: session.duration_minutes,
        plannedQuestions: session.planned_questions,
      },
      state: { status: session.status, elapsedSeconds: Math.max(0, (now - start) / 1000) },
      jdText: session.jd_text, cvText: session.cv_text, history,
    });
  } catch {
    throw new InterviewerError('SESSION_CONTEXT_INVALID', 'The saved session context is invalid or too large.', 409);
  }
}

export function createNextService({ repository, provider, now = Date.now }) {
  return async function next(body, { signal } = {}) {
    const request = validateNextRequest(body);
    if (signal?.aborted) throw new InterviewerError('REQUEST_CANCELLED', 'Request cancelled.', 408);
    // Claim is atomic in PostgreSQL; no transaction stays open across an AI call.
    const claim = await repository.claim(request);
    if (claim.kind === 'ready') return claim.response;
    if (claim.kind === 'busy') throw new InterviewerError('GENERATION_IN_PROGRESS', 'A question is already being generated. Try this turn again shortly.', 409);
    if (claim.kind !== 'claimed' || !isUuid(claim.token)) throw new InterviewerError('SERVER_ERROR', 'Could not prepare this turn.', 500);
    let decision;
    try {
      const context = contextFromSnapshot(claim, now());
      decision = validateInterviewerOutput(await provider.next(context, { signal }), context);
      if (signal?.aborted) throw new InterviewerError('REQUEST_CANCELLED', 'Request cancelled.', 408);
    } catch (error) {
      // Failed generation/validation may be explicitly retried. Never hide the
      // failure behind a canned question or an automatic billable AI retry.
      await repository.release(request, claim.token).catch(() => {});
      throw error;
    }
    // An uncertain commit is deliberately not released: a retry must first
    // recover the persisted result, or wait for the lease to expire.
    try {
      return await repository.finish(request, claim.token, decision, {
        model: provider.model, promptVersion: PROMPT_VERSION, contextVersion: QUESTION_PLAN_VERSION,
        memoryVersion: CONVERSATION_MEMORY_VERSION,
      });
    } catch (error) {
      // These RPC results explicitly mean no question was committed. Other
      // errors can be a lost acknowledgement and must preserve the lease.
      if (error instanceof InterviewerError && ['INVALID_OUTPUT', 'STALE_TURN', 'LEASE_LOST'].includes(error.code)) {
        await repository.release(request, claim.token).catch(() => {});
      }
      throw error;
    }
  };
}
