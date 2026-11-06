import { InterviewerError } from './interviewer-contract.mjs';

// Server only. The supplied Supabase client acts as the signed-in user.
export function createNextRepository(supabase) {
  async function rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      if (['PGRST202', '42883', '42P01'].includes(error.code)) {
        throw new InterviewerError('DATABASE_NOT_READY', 'The interview-next database migration has not been applied.', 503);
      }
      throw new InterviewerError('SERVER_ERROR', 'The interview turn could not be saved.', 500);
    }
    if (!data || typeof data !== 'object') throw new InterviewerError('SERVER_ERROR', 'Invalid database response.', 500);
    if (data.error) {
      const status = { NOT_FOUND: 404, STALE_TURN: 409, LEASE_LOST: 409, INVALID_OUTPUT: 502 }[data.error] ?? 500;
      throw new InterviewerError(data.error, {
        NOT_FOUND: 'Interview session not found.', STALE_TURN: 'Reload the current question before continuing.',
        LEASE_LOST: 'This generation is no longer current. Reload the current question.',
        INVALID_OUTPUT: 'The question did not pass validation.',
      }[data.error] ?? 'The interview turn could not be saved.', status);
    }
    return data;
  }
  const args = (request) => ({ p_session_id: request.sessionId, p_after_answer_id: request.afterAnswerId });
  return {
    claim: (request) => rpc('claim_interview_next', args(request)),
    finish: (request, token, decision, metadata) => rpc('finish_interview_next', {
      ...args(request), p_token: token, p_decision: decision, p_metadata: metadata,
    }),
    release: (request, token) => rpc('release_interview_next', { ...args(request), p_token: token }),
  };
}
