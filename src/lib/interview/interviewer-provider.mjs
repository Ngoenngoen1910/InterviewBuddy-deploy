import { DEFAULT_MODEL } from '../analysis/gemini.mjs';
import { createEndDecision, InterviewerError, validateInterviewerInput, validateInterviewerOutput } from './interviewer-contract.mjs';
import { buildInterviewerRequest } from './interviewer-prompt.mjs';

/** Server / Node only: keep this provider out of client components. No DB writes or automatic retries. */
export function createInterviewerProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const model = env.GEMINI_INTERVIEW_MODEL?.trim() || env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  return {
    model,
    async next(value, { signal } = {}) {
      const input = validateInterviewerInput(value);
      if (signal?.aborted) throw new InterviewerError('REQUEST_CANCELLED', 'The request was cancelled.', 408);
      const ending = createEndDecision(input);
      if (ending) return validateInterviewerOutput(ending, input);
      const apiKey = env.GEMINI_API_KEY?.trim();
      if (!apiKey) throw new InterviewerError('AI_NOT_CONFIGURED', 'Gemini is not configured on the server.', 503);
      const timeoutMs = Number(env.GEMINI_TIMEOUT_MS || 30000);
      if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 45000) {
        throw new InterviewerError('AI_CONFIGURATION_ERROR', 'Invalid server Gemini configuration.', 503);
      }
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', redirect: 'error', signal: combined,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(buildInterviewerRequest(input)),
        });
        if (!response.ok) {
          // Provider bodies may echo inputs or credentials. Never log or forward them.
          await response.body?.cancel();
          const code = response.status === 429 ? 'AI_RATE_LIMITED'
            : [400, 401, 403, 404].includes(response.status) ? 'AI_CONFIGURATION_ERROR' : 'AI_UNAVAILABLE';
          throw new InterviewerError(code, 'Gemini could not complete the interview request.', code === 'AI_RATE_LIMITED' ? 429 : code === 'AI_CONFIGURATION_ERROR' ? 503 : 502);
        }
        const envelope = await response.json();
        const candidate = envelope?.candidates?.[0];
        if (envelope?.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') {
          throw new InterviewerError('AI_CONTENT_BLOCKED', 'The interview request was blocked by the provider.', 422);
        }
        if (candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) {
          throw new InterviewerError('INVALID_OUTPUT', 'Gemini returned an incomplete interview response.');
        }
        const output = candidate.content.parts.filter((part) => part && !part.thought && typeof part.text === 'string').map((part) => part.text).join('');
        if (!output || output.length > 12000) throw new InterviewerError('INVALID_OUTPUT', 'Gemini returned an invalid interview response.');
        return validateInterviewerOutput(JSON.parse(output), input);
      } catch (error) {
        if (error instanceof InterviewerError) throw error;
        if (signal?.aborted) throw new InterviewerError('REQUEST_CANCELLED', 'The request was cancelled.', 408);
        if (timeout.aborted) throw new InterviewerError('AI_TIMEOUT', 'The interview request timed out.', 504);
        if (error instanceof SyntaxError) throw new InterviewerError('INVALID_OUTPUT', 'Gemini returned invalid JSON.');
        throw new InterviewerError('AI_UNAVAILABLE', 'Gemini is temporarily unavailable.');
      }
    },
  };
}
